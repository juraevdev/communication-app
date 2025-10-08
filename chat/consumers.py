import json
import base64
import logging

from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.db.models import Q

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from chat.models import Room, Message, FileUpload

logger = logging.getLogger(__name__)


@database_sync_to_async
def set_user_online_status(user, status):
    try:
        user.is_online = status
        update_fields = ["is_online"]
        
        if not status:
            user.last_seen = timezone.now()
            update_fields.append("last_seen")
            
        user.save(update_fields=update_fields)
        return True
    except Exception as e:
        logger.error(f"Error setting user online status: {e}")
        return False
    

@database_sync_to_async
def increment_connection(user_id):
    key = f"user:{user_id}:connections"
    count = cache.get(key, 0) + 1
    cache.set(key, count, timeout=None)
    return count


@database_sync_to_async
def decrement_connection(user_id):
    key = f"user:{user_id}:connections"
    count = max(cache.get(key, 0) - 1, 0)
    cache.set(key, count, timeout=None)
    return count


class StatusConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
            return

        connections = await increment_connection(user.id)
        if connections == 1: 
            await set_user_online_status(user, True)

        await self.channel_layer.group_add("status", self.channel_name)
        await self.accept()

        await self.channel_layer.group_send(
            "status",
            {
                "type": "status_update",
                "user_id": user.id,
                "status": "online",
                "timestamp": timezone.now().isoformat()
            }
        )

    async def disconnect(self, code):
        user = self.scope["user"]

        remaining = await decrement_connection(user.id)
        if remaining == 0:  
            await set_user_online_status(user, False)
            await self.channel_layer.group_send(
                "status",
                {
                    "type": "status_update",
                    "user_id": user.id,
                    "status": "offline",
                    "timestamp": timezone.now().isoformat()
                }
            )

        await self.channel_layer.group_discard("status", self.channel_name)

    async def status_update(self, event):
        await self.send_json(event)



class BaseChatConsumer(AsyncJsonWebsocketConsumer):
    async def validate_user_and_room(self):
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return False
            
        try:
            self.room = await self.get_room()
            if not self.room:
                await self.close(code=4004)
                return False
                
            if not await self.user_in_room():
                await self.close(code=4003)
                return False
                
            return True
        except Exception as e:
            logger.error(f"Validation error: {e}")
            await self.close(code=4000)
            return False
    
    async def send_error(self, error_message, error_code="error"):
        await self.send_json({
            "type": error_code,
            "message": error_message
        })
    
    async def send_success(self, success_message):
        await self.send_json({
            "type": "success",
            "message": success_message
        })



class P2PChatConsumer(BaseChatConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'p2p_chat_{self.room_id}'

        if not await self.validate_user_and_room():
            return
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.channel_layer.group_add(
            f"notifications_{self.user.id}",
            self.channel_name
        )

        await self.accept()

        last_messages = await self.get_last_messages()
        await self.send_json({  
            "type": "message_history",
            "messages": last_messages
        })


    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            await self.channel_layer.group_discard(
                f"notifications_{self.user.id}",
                self.channel_name
            )
        except Exception as e:
            logger.error(f"Error leaving groups: {e}")


    async def user_status(self, event):
        await self.send_json({
            "type": "status_update",
            "user_id": event["user_id"],
            "status": event["status"],
            "timestamp": event.get("timestamp")
        })


    async def receive_json(self, content, **kwargs):
        action = content.get('action')

        if not action:
            await self.send_error('action is required', 'action_required')
            return
    
        if not self.user.is_authenticated:
            await self.send_error("Authentication required", 'auth_required')
            return
    
        if action == 'send':
            await self.handle_send(content)
        elif action == 'read':
            await self.handle_read(content)
        elif action == 'edit_message':
            await self.handle_edit(content)
        elif action == 'delete_message':
            await self.handle_delete_message(content)
        elif action == 'delete_file':
            await self.handle_delete_file(content)
        elif action == 'upload_file':
            await self.handle_upload_file(content)
        elif action == 'read_file':
            await self.handle_read_file(content)
        elif action == 'get_files':
            await self.handle_get_files(content)
        else:
            await self.send_error(
                "Invalid action. Choose from: send, read, delete_message, delete_file, edit_message, upload_file, read_file, get_files", 
                'invalid_action'
            )


    async def handle_send(self, content):
        message_text = content.get('message')
        if not message_text or not message_text.strip():
            await self.send_error("Message is required", 'message_required')
            return

        saved_message = await self.save_message(message_text)
        if not saved_message:
            await self.send_error("Failed to save message", 'save_error')
            return

        message_data = await self.get_message_data(saved_message.id)
        if not message_data:
            await self.send_error("Failed to get message data", 'data_error')
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message_data  
            }
        )

        recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
        unread_count = await self.get_unread_count_for_recipient(self.room.id, recipient.id)
        await self.send_unread_count_update(recipient.id, unread_count) 


    async def handle_read(self, content):
        message_id = content.get("message_id")
        file_id = content.get("file_id")

        if not message_id and not file_id:
            await self.send_error("message_id or file_id is required", "id_required")
            return

        success = False
        read_type = None
        item_id = None

        if message_id:
            try:
                item_id = int(message_id)
                success = await self.mark_message_as_read(item_id)
                read_type = "message"
            except (ValueError, TypeError):
                await self.send_error(f"Invalid message ID: {message_id}", "invalid_id")
                return
            
        elif file_id:
            try:
                item_id = int(file_id)
                success = await self.mark_file_as_read(item_id)
                read_type = "file"
            except (ValueError, TypeError):
                await self.send_error(f"Invalid file ID: {file_id}", "invalid_id")
                return

        if success:
            await self.send_success(f"{read_type} marked as read")
    
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "read_update",
                    "message_id": message_id,
                    "file_id": file_id,
                    "user_id": self.user.id,
                    "success": success,
                }
            )
    
            unread_count = await self.get_unread_count_for_recipient(self.room.id, self.user.id)
            await self.send_unread_count_update(self.user.id, unread_count)
        else:
            error_msg = f"Failed to mark {read_type} as read" if read_type else "Failed to mark as read"
            await self.send_error(error_msg, 'mark_error')


    async def read(self, event):
        await self.send_json({
            "type": "read",
            "message_id": event.get("message_id"),
            "file_id": event.get("file_id"),
            "success": event["success"],
        })


    async def read_update(self, event):
        await self.send_json({
            "type": "read",
            "message_id": event.get("message_id"),
            "file_id": event.get("file_id"),
            "user_id": event["user_id"],
            "success": event["success"],
        })


    async def handle_delete_message(self, content):
        message_id = content.get('message_id')
        if not message_id:
            await self.send_error("message_id required", 'id_required')
            return
    
        success = await self.delete_message(message_id)
        if success:
            await self.send_success('Message deleted successfully')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "message_deleted",
                    "message_id": message_id,
                    "room_id": self.room_id,
                    "user_id": self.user.id
                }
            )
        else:
            await self.send_error("You cannot delete this message or message not found", 'permission_error')


    async def handle_edit(self, content):
        message_id = content.get('message_id')
        new_content = content.get('new_content')

        if not message_id or not new_content:
            await self.send_error('message_id and new_content are required', 'params_required')
            return

        success = await self.edit_message(message_id, new_content)
        if success:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "message_updated",
                    "message_id": message_id,
                    "new_content": new_content,
                    "room_id": self.room_id
                }
            )
            await self.send_success('Message updated successfully')
        else:
            await self.send_error('You cannot edit this message or message not found', 'permission_error')


    async def message_updated(self, event):
        await self.send_json({
            'type': 'message_updated',
            'message_id': event['message_id'],
            'new_content': event['new_content'],
            'room_id': event['room_id']
        })


    async def handle_upload_file(self, content):
        file_data = content.get('file_data')
        file_name = content.get('file_name')
        file_type = content.get('file_type')
    
        if not file_data or not file_name:
            await self.send_error("file_data and file_name are required", 'params_required')
            return
    
        file_upload = await self.save_file(file_data, file_name, file_type)
        if file_upload:
            file_info = await self.get_file_data(file_upload.id)
        
            if file_info is None:
                await self.send_error("Failed to get file information", 'data_error')
                return
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "file_uploaded",
                    **file_info
                }
            )
            recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
            unread_count = await self.get_unread_count_for_recipient(self.room.id, recipient.id)
            await self.send_unread_count_update(recipient.id, unread_count)
        else:
            await self.send_error("Failed to upload file", 'upload_error')


    async def handle_read_file(self, content):
        file_id = content.get('file_id')
        if not file_id:
            await self.send_error("file_id is required", 'id_required')
            return
    
        success = await self.mark_file_as_read(file_id)
        if success:
            await self.send_success('File marked as read')
        else:
            await self.send_error('Failed to mark file as read', 'mark_error')


    async def handle_delete_file(self, content):
        file_id = content.get('file_id')
        if not file_id:
            await self.send_error("file_id required", 'id_required')
            return

        success = await self.delete_file(file_id)
        if success:
            await self.send_success('File deleted')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "file_deleted",
                    "file_id": file_id, 
                    "user_id": self.user.id
                }
            )
        else:
            await self.send_error("You cannot delete this file or file not found", 'permission_error')
            
            
    async def file_deleted(self, event):
        await self.send_json({
            'type': 'file_deleted',
            'file_id': event['file_id'],  
            'user_id': event['user_id']
        })
            


    async def chat_message(self, event):
        message_data = event["message"] 
    
        sender_id = message_data.get("sender_id")
        recipient_id = message_data.get("recipient_id")
        room_id = message_data.get("room_id")

        await self.send_json({
            "type": "chat_message",
            **message_data,
        })

        if self.user.id == recipient_id: 
            unread_count = await self.get_unread_count_for_recipient(room_id, recipient_id)
            await self.send_unread_count_update(recipient_id, unread_count)


    async def message_deleted(self, event):
        await self.send_json({
            'type': 'message_deleted',
            'message_id': event['message_id'],
            'room_id': event['room_id'],
            'user_id': event['user_id']
        })


    async def file_uploaded(self, event):
        await self.send_json({
            'type': 'file_uploaded',
            'id': event['id'],
            'file_name': event['file_name'],
            'file_url': event['file_url'],
            'user': event['user'],
            'uploaded_at': event['uploaded_at']
        })


    async def unread_count_update(self, event):
        await self.send_json({
            "type": "unread_count_update",
            "contact_id": event["contact_id"],
            "unread_count": event["unread_count"],
        })


    async def send_unread_count_update(self, user_id, unread_count):
        try:
            if user_id == self.user.id:
                return
            
            contact_id = await self.get_contact_id_for_user(user_id)
        
            await self.channel_layer.group_send(
                f"notifications_{user_id}",
                {
                    "type": "unread_count_update",
                    "contact_id": contact_id,
                    "unread_count": unread_count,
                }
        )
        except Exception as e:
            logger.error(f"Error in send_unread_count_update: {e}")


    @database_sync_to_async
    def get_contact_id_for_user(self, user_id):
        try:
            current_user_id = self.user.id
            
            if user_id == self.room.user1.id:
                return self.room.user2.id  
            else:
                return self.room.user1.id  
                
        except Exception as e:
            logger.error(f"Error getting contact ID: {e}")
            return current_user_id
        
        
    @database_sync_to_async
    def get_unread_count(self, room_id, recipient_id):
        return Message.objects.filter(
            room_id=room_id,
            recipient_id=recipient_id,
            is_read=False
        ).count()


    @database_sync_to_async
    def get_message_data(self, message_id):
        try:
            message = Message.objects.select_related('sender').get(
                id=message_id, 
                room=self.room
            )
            return {
                'id': str(message.id),
                "message": message.text,
                'sender': {
                    "id": str(message.sender.id),
                    "email": message.sender.email,
                    "full_name": message.sender.fullname,
                    "fullname": message.sender.fullname 
                },
                'is_updated': message.is_updated,
                'is_read': message.is_read,
                'timestamp': str(message.timestamp),  
            }
        except (Message.DoesNotExist, ValidationError) as e:
            logger.error(f"Error getting message data: {e}")
            return None


    @database_sync_to_async
    def get_room(self):
        try:
            return Room.objects.get(id=self.room_id)
        except (Room.DoesNotExist, ValidationError) as e:
            logger.error(f"Room not found: {e}")
            return None


    @database_sync_to_async
    def user_in_room(self):
        try:
            return self.room and self.user in [self.room.user1, self.room.user2]
        except Exception as e:
            logger.error(f"Error checking user in room: {e}")
            return False


    @database_sync_to_async
    def save_message(self, message_text):
        try:
            recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
            
            return Message.objects.create(
                room=self.room,
                sender=self.user,
                recipient=recipient,
                text=message_text.strip()
            )
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return None


    @database_sync_to_async
    def get_last_messages(self, limit=50):
        try:
            text_messages = Message.objects.filter(
                room=self.room
            ).select_related('sender').order_by('-timestamp')[:limit]
    
            file_messages = FileUpload.objects.filter(
                room=self.room
            ).select_related('user').order_by('-uploaded_at')[:limit]
    
            all_messages = []
    
            for msg in text_messages:
                all_messages.append({
                    "type": "text",
                    "id": str(msg.id),
                    "message": msg.text,
                    'sender': {
                        "id": str(msg.sender.id),
                        "email": msg.sender.email,
                        "full_name": msg.sender.fullname,
                        "fullname": msg.sender.fullname  
                    },
                    "is_read": msg.is_read,
                    "is_updated": msg.is_updated,
                    "timestamp": str(msg.timestamp),
                })
    
            for file_msg in file_messages:
                file_name = (file_msg.original_filename 
                            if hasattr(file_msg, 'original_filename') and file_msg.original_filename 
                            else file_msg.file.name.split('/')[-1])
        
                all_messages.append({
                    "type": "file",
                    "id": str(file_msg.id),
                    "message": file_name,
                    'sender': {
                        "id": str(file_msg.user.id),
                        "email": file_msg.user.email,
                        "full_name": file_msg.user.fullname,
                        "fullname": file_msg.user.fullname  
                    },
                    "is_read": file_msg.is_read,
                    "is_updated": False,
                    "timestamp": str(file_msg.uploaded_at),
                    "file_name": file_name,
                    "file_url": getattr(file_msg, 'file_url', None),
                    "file_type": self.get_file_type(file_name),
                })
    
            all_messages.sort(key=lambda x: x['timestamp'], reverse=True)
    
            return all_messages[:limit]
        except Exception as e:
            logger.error(f"Error getting last messages: {e}")
            return []


    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        try:
            message = Message.objects.get(
                id=message_id, 
                room=self.room,
                recipient=self.user
            )
        
            if not message.is_read:
                message.is_read = True
                message.save(update_fields=["is_read"])
                logger.info(f"Message {message_id} marked as read by user {self.user.id}")
        
            return True
        except Message.DoesNotExist:
            logger.error(f"Message not found: {message_id}, user: {self.user.id}, room: {self.room.id}")
            return False
        except Exception as e:
            logger.error(f"Error marking message as read: {e}")
            return False


    @database_sync_to_async
    def delete_message(self, message_id):
        try:
            message = Message.objects.get(
                id=message_id, 
                sender=self.user, 
                room=self.room
            )
            message.delete()
            return True
        except Message.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error deleting message: {e}")
            return False


    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        try:
            message = Message.objects.get(
                id=message_id, 
                room=self.room, 
                sender=self.user
            )
    
            if message.text == new_content.strip():
                return True  
        
            message.text = new_content.strip()
            message.is_updated = True
            message.save(update_fields=["text", "is_updated"])
    
            logger.info(f"Message {message_id} updated by user {self.user.id} (timestamp unchanged)")
            return True
        except Message.DoesNotExist:
            logger.error(f"Message not found for edit: {message_id}, user: {self.user.id}")
            return False
        except Exception as e:
            logger.error(f"Error editing message: {e}")
            return False


    @database_sync_to_async
    def save_file(self, file_data, file_name, file_type=None):
        try:
            if ';base64,' in file_data:
                format, file_str = file_data.split(';base64,')
                file_bytes = base64.b64decode(file_str)
            else:
                file_bytes = base64.b64decode(file_data)
    
            file_content = ContentFile(file_bytes, name=file_name)
    
            recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
    
            file_upload = FileUpload(
                user=self.user,
                file=file_content,
                room=self.room,
                recipient=recipient
            )
    
            if hasattr(FileUpload, 'original_filename'):
                file_upload.original_filename = file_name
        
            file_upload.save()
    
            logger.info(f"File uploaded successfully: {file_upload.id}")
            return file_upload
        except Exception as e:
            logger.error(f"File upload error: {e}")
            return None


    @database_sync_to_async
    def get_file_data(self, file_upload_id):
        try:
            file_upload = FileUpload.objects.select_related('user').get(id=file_upload_id)
    
            file_url = file_upload.file_url
        
            if hasattr(file_upload, 'original_filename') and file_upload.original_filename:
                file_name = file_upload.original_filename
            else:
                file_name = file_upload.file.name.split('/')[-1]
    
            return {
                'id': str(file_upload.id),
                'file_name': file_name,
                'file_url': file_url,
                'file_size': file_upload.file.size if file_upload.file else 0,
                'file_type': self.get_file_type(file_name),
                'user': {
                    'id': str(file_upload.user.id),
                    'email': file_upload.user.email,
                    'full_name': file_upload.user.fullname
                },
                'uploaded_at': str(file_upload.uploaded_at)
            }
        except FileUpload.DoesNotExist:
            logger.error(f"File upload not found: {file_upload_id}")
            return None
        except Exception as e:
            logger.error(f"Error getting file data: {e}")
            return None
        
        
    def get_file_type(self, file_name):
        if not file_name:
            return 'file'
    
        extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
    
        if extension in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            return 'image'
        elif extension in ['mp4', 'avi', 'mov', 'wmv']:
            return 'video'
        elif extension in ['mp3', 'wav', 'ogg', 'flac']:
            return 'audio'
        elif extension == 'pdf':
            return 'pdf'
        elif extension in ['doc', 'docx']:
            return 'word'
        elif extension in ['xls', 'xlsx']:
            return 'excel'
        elif extension in ['zip', 'rar']:
            return 'archive'
        elif extension in ['txt']:
            return 'text'
        else:
            return 'file'


    @database_sync_to_async
    def mark_file_as_read(self, file_id):
        try:
            try:
                file_id = int(file_id)
            except (ValueError, TypeError):
                logger.error(f"Invalid file ID: {file_id}")
                return False
        
            file_upload = FileUpload.objects.get(
                id=file_id,
                room=self.room,  
                recipient=self.user  
            )
        
            if not file_upload.is_read:  
                file_upload.is_read = True
                file_upload.save(update_fields=["is_read"])
        
            logger.info(f"File {file_id} marked as read by user {self.user.id}")
            return True
        except FileUpload.DoesNotExist:
            logger.error(f"File upload not found or access denied: {file_id}, user: {self.user.id}")
            return False
        except Exception as e:
            logger.error(f"Error marking file as read: {e}")
            return False


    @database_sync_to_async
    def get_unread_count_for_recipient(self, room_id, recipient_id):
        try:
            message_count = Message.objects.filter(
                room_id=room_id,
                recipient_id=recipient_id,
                is_read=False
            ).count()
        
            file_count = FileUpload.objects.filter(
                room_id=room_id,
                recipient_id=recipient_id,
                is_read=False
            ).count()
        
            total_unread = message_count + file_count
            logger.info(f"Unread count for user {recipient_id} in room {room_id}: {total_unread} (messages: {message_count}, files: {file_count})")
            return total_unread
        except Exception as e:
            logger.error(f"Error calculating unread count: {e}")
            return 0


    @database_sync_to_async
    def delete_file(self, file_id):
        try:
            file_upload = FileUpload.objects.get(
                id=file_id,
                user=self.user, 
                room=self.room
            )
            if file_upload.file:
                file_upload.file.delete(save=False)
        
            file_upload.delete()
            return True
        except FileUpload.DoesNotExist:
            logger.error(f"File upload not found: {file_id}, user: {self.user.id}")
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False
    

    async def handle_get_files(self, content):
        files = await self.get_room_files()
        await self.send_json({
            "type": "file_list",
            "files": files
        })


    @database_sync_to_async
    def get_room_files(self):
        try:
            files = FileUpload.objects.filter(room=self.room).select_related('user')
            return [
                {
                    'id': file.id,
                    'name': file.original_filename if hasattr(file, 'original_filename') and file.original_filename else file.file.name.split('/')[-1],
                    'type': self.get_file_type(file.file.name),
                    'size': self.format_file_size(file.file.size),
                    'uploadedBy': file.user.fullname,
                    'uploadDate': file.uploaded_at.strftime("%Y-%m-%d %H:%M"),
                    'downloadCount': file.download_count if hasattr(file, 'download_count') else 0
                }
                for file in files
            ]
        except Exception as e:
            logger.error(f"Error getting room files: {e}")
            return []


    def format_file_size(self, size_bytes):
        if size_bytes == 0:
            return "0B"
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names)-1:
            size_bytes /= 1024.0
            i += 1
        return f"{size_bytes:.1f}{size_names[i]}"


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.group_name = f'notifications_{self.user.id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()
        
        logger.info(f"User {self.user.id} connected to notifications")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            try:
                await self.channel_layer.group_discard(
                    self.group_name,
                    self.channel_name
                )
                logger.info(f"User {self.user.id} disconnected from notifications")
            except Exception as e:
                logger.error(f"Error disconnecting from notifications: {e}")


    async def receive_json(self, content, **kwargs):
        action = content.get('action')

        if not action:
            await self.send_error('action is required', 'action_required')
            return
    
        if not self.user.is_authenticated:
            await self.send_error("Authentication required", 'auth_required')
            return
    
        if action == 'get_recent_conversations':
            await self.handle_get_recent_conversations()
        else:
            await self.send_error("Invalid action", 'invalid_action')


    async def send_error(self, error_message, error_code="error"):
        await self.send_json({
            "type": error_code,
            "message": error_message
        })


    async def handle_get_recent_conversations(self):
        conversations = await self.get_recent_conversations()
        await self.send_json({
            "type": "recent_conversations",
            "conversations": conversations
        })


    @database_sync_to_async
    def get_recent_conversations(self):
        try:
            from django.db.models import Q, Max
            from chat.models import Room, Message, FileUpload
            from accounts.models import Contact  # Kontakt modelini import qiling
        
            user = self.user
        
            user_rooms = Room.objects.filter(
                Q(user1=user) | Q(user2=user)
            ).select_related('user1', 'user2')
        
            conversations = []
        
            for room in user_rooms:
                other_user = room.user2 if room.user1 == user else room.user1
            
                try:
                    contact = Contact.objects.filter(
                        user=user, 
                        contact_user=other_user
                    ).first()
                    alias = contact.alias if contact else None
                except Exception as e:
                    logger.error(f"Error getting contact alias: {e}")
                    alias = None
            
                latest_text_message = Message.objects.filter(room=room).order_by('-timestamp').first()
                latest_file_upload = FileUpload.objects.filter(room=room).order_by('-uploaded_at').first()
            
                latest_timestamp = None
                last_message = "No messages yet"
                message_type = "text"
            
                if latest_text_message and latest_file_upload:
                    if latest_text_message.timestamp > latest_file_upload.uploaded_at:
                        latest_timestamp = latest_text_message.timestamp
                        last_message = latest_text_message.text
                        message_type = "text"
                    else:
                        latest_timestamp = latest_file_upload.uploaded_at
                        file_name = (latest_file_upload.original_filename 
                                if hasattr(latest_file_upload, 'original_filename') and latest_file_upload.original_filename
                                else latest_file_upload.file.name.split('/')[-1])
                        last_message = file_name
                        message_type = "file"
                elif latest_text_message:
                    latest_timestamp = latest_text_message.timestamp
                    last_message = latest_text_message.text
                    message_type = "text"
                elif latest_file_upload:
                    latest_timestamp = latest_file_upload.uploaded_at
                    file_name = (latest_file_upload.original_filename 
                            if hasattr(latest_file_upload, 'original_filename') and latest_file_upload.original_filename
                            else latest_file_upload.file.name.split('/')[-1])
                    last_message = file_name
                    message_type = "file"
            
                if not latest_timestamp:
                    continue
            
                unread_messages = Message.objects.filter(
                    room=room,
                    recipient=user,
                    is_read=False
                ).count()
            
                unread_files = FileUpload.objects.filter(
                    room=room,
                    recipient=user,
                    is_read=False
                ).count()
            
                total_unread = unread_messages + unread_files
            
                conversations.append({
                    'id': room.id,
                    'sender': alias or other_user.fullname,  # ✅ Avval alias, keyin fullname
                    'sender_id': other_user.id,
                    'last_message': last_message,
                    'message_type': message_type,
                    'timestamp': latest_timestamp.isoformat(),
                    'unread': total_unread,
                    'alias': alias,  # ✅ Alias ni alohida saqlash
                    'is_contact': bool(alias)  # ✅ Kontakt ekanligini belgilash
                })
        
            conversations.sort(key=lambda x: x['timestamp'], reverse=True)
        
            return conversations[:]
        
        except Exception as e:
            logger.error(f"Error getting recent conversations: {e}")
            return []


    async def notify(self, event):
        try:
            await self.send_json({
                'type': 'notification',
                'message': event['message'],
                'data': event.get('data', {}),
                'timestamp': str(timezone.now())
            })
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            
            
    async def unread_count_update(self, event):
        await self.send_json({
            "type": "unread_count_update",
            "contact_id": event["contact_id"],
            "unread_count": event["unread_count"],
        })
        
        
        
class FilesConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        
        if isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.user_group_name = f'files_{self.user.id}'
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"User {self.user.id} connected to files WebSocket")


    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
            logger.info(f"User {self.user.id} disconnected from files WebSocket")
        except Exception as e:
            logger.error(f"Error disconnecting from files group: {e}")


    async def receive_json(self, content, **kwargs):
        action = content.get('action')

        if not action:
            await self.send_error('action is required', 'action_required')
            return
    
        if not self.user.is_authenticated:
            await self.send_error("Authentication required", 'auth_required')
            return
    
        if action == 'get_files':
            await self.handle_get_files(content)
        elif action == 'upload_file':
            await self.handle_upload_file(content)
        elif action == 'delete_file':
            await self.handle_delete_file(content)
        elif action == 'file_downloaded':
            await self.handle_file_downloaded(content)
        else:
            await self.send_error(
                "Invalid action. Choose from: get_files, upload_file, delete_file, file_downloaded", 
                'invalid_action'
            )


    async def send_error(self, error_message, error_code="error"):
        await self.send_json({
            "type": error_code,
            "message": error_message
        })
    
    
    async def send_success(self, success_message):
        await self.send_json({
            "type": "success",
            "message": success_message
        })


    async def handle_get_files(self, content):
        files = await self.get_user_files()
        await self.send_json({
            "type": "file_list",
            "files": files
        })


    async def handle_upload_file(self, content):
        file_data = content.get('file_data')
        file_name = content.get('file_name')
        file_type = content.get('file_type')
        room_id = content.get('room_id')
    
        if not file_data or not file_name:
            await self.send_error("file_data and file_name are required", 'params_required')
            return
    
        file_upload = await self.save_file(file_data, file_name, file_type, room_id)
        if file_upload:
            file_info = await self.get_file_data(file_upload.id)
        
            if file_info is None:
                await self.send_error("Failed to get file information", 'data_error')
                return
            
            await self.send_json({
                "type": "file_uploaded",
                "file": file_info,
                "message": "File uploaded successfully"
            })
            
            if room_id:
                await self.notify_room_participants(room_id, file_info)
        else:
            await self.send_error("Failed to upload file", 'upload_error')


    async def handle_delete_file(self, content):
        file_id = content.get('file_id')
        if not file_id:
            await self.send_error("file_id required", 'id_required')
            return

        success = await self.delete_file(file_id)
        if success:
            await self.send_success('File deleted successfully')
            await self.send_json({
                "type": "file_deleted",
                "file_id": file_id
            })
        else:
            await self.send_error("You cannot delete this file or file not found", 'permission_error')


    async def handle_file_downloaded(self, content):
        file_url = content.get('file_url')
        if file_url:
            success = await self.increment_download_count(file_url)
            if success:
                await self.send_success('Download recorded')
            else:
                await self.send_error('Failed to record download', 'download_error')


    async def notify_room_participants(self, room_id, file_info):
        try:
            room = await self.get_room(room_id)
            if room:
                participants = [room.user1.id, room.user2.id]
                
                for participant_id in participants:
                    if participant_id != self.user.id:  
                        await self.channel_layer.group_send(
                            f'files_{participant_id}',
                            {
                                "type": "file_uploaded_notification",
                                "file": file_info,
                                "uploaded_by": self.user.fullname,
                                "room_id": room_id
                            }
                        )
        except Exception as e:
            logger.error(f"Error notifying room participants: {e}")


    async def file_uploaded_notification(self, event):
        await self.send_json({
            "type": "room_file_uploaded",
            "file": event["file"],
            "uploaded_by": event["uploaded_by"],
            "room_id": event["room_id"],
            "message": "New file uploaded to room"
        })


    @database_sync_to_async
    def get_user_files(self):
        try:
            user_rooms = Room.objects.filter(
                Q(user1=self.user) | Q(user2=self.user)
            )
            
            files = FileUpload.objects.filter(
                Q(user=self.user) | Q(room__in=user_rooms)
            ).select_related('user', 'room').order_by('-uploaded_at')
            
            return [
                {
                    'id': file.id,
                    'name': file.original_filename if hasattr(file, 'original_filename') and file.original_filename else file.file.name.split('/')[-1],
                    'type': self.get_file_type(file.file.name),
                    'size': self.format_file_size(file.file.size),
                    'uploadedBy': file.user.fullname,
                    'uploadDate': file.uploaded_at.strftime("%Y-%m-%d %H:%M"),
                    'downloadCount': file.download_count if hasattr(file, 'download_count') else 0,
                    'isOwner': file.user.id == self.user.id,
                    'fileUrl': file.file.url if file.file else None,
                    'fileName': file.original_filename if hasattr(file, 'original_filename') and file.original_filename else file.file.name.split('/')[-1],
                    'roomId': file.room.id if file.room else None
                }
                for file in files
            ]
        except Exception as e:
            logger.error(f"Error getting user files: {e}")
            return []


    @database_sync_to_async
    def save_file(self, file_data, file_name, file_type=None, room_id=None):
        try:
            if ';base64,' not in file_data:
                logger.error("Invalid file data format")
                return None
            
            format, file_str = file_data.split(';base64,')
            file_bytes = base64.b64decode(file_str)
        
            file_content = ContentFile(file_bytes, name=file_name)
        
            room = None
            if room_id:
                try:
                    room = Room.objects.get(id=room_id)
                    if room.user1 != self.user and room.user2 != self.user:
                        logger.error(f"User {self.user.id} is not participant in room {room_id}")
                        return None
                except Room.DoesNotExist:
                    logger.error(f"Room not found: {room_id}")
                    return None
        
            file_upload = FileUpload(
                user=self.user,
                file=file_content,
                room=room
            )
        
            if hasattr(FileUpload, 'original_filename'):
                file_upload.original_filename = file_name
            
            file_upload.save()
        
            logger.info(f"File uploaded successfully: {file_upload.id}")
            return file_upload
        except Exception as e:
            logger.error(f"File upload error: {e}")
            return None


    @database_sync_to_async
    def get_file_data(self, file_upload_id):
        try:
            file_upload = FileUpload.objects.select_related('user', 'room').get(id=file_upload_id)
    
            file_name = (file_upload.original_filename 
                        if hasattr(file_upload, 'original_filename') and file_upload.original_filename 
                        else file_upload.file.name.split('/')[-1])
    
            return {
                'id': file_upload.id,
                'name': file_name,
                'type': self.get_file_type(file_name),
                'size': self.format_file_size(file_upload.file.size),
                'uploadedBy': file_upload.user.fullname,
                'uploadDate': file_upload.uploaded_at.strftime("%Y-%m-%d %H:%M"),
                'downloadCount': file_upload.download_count if hasattr(file_upload, 'download_count') else 0,
                'isOwner': file_upload.user.id == self.user.id,
                'fileUrl': file_upload.file.url,
                'fileName': file_name,
                'roomId': file_upload.room.id if file_upload.room else None
            }
        except FileUpload.DoesNotExist:
            logger.error(f"File upload not found: {file_upload_id}")
            return None
        except Exception as e:
            logger.error(f"Error getting file data: {e}")
            return None


    @database_sync_to_async
    def delete_file(self, file_id):
        try:
            file_upload = FileUpload.objects.get(id=file_id)
            
            if file_upload.user != self.user and self.user.role != 'Admin':
                return False
            
            if file_upload.file:
                file_upload.file.delete(save=False)
        
            file_upload.delete()
            return True
        except FileUpload.DoesNotExist:
            logger.error(f"File upload not found: {file_id}")
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False


    @database_sync_to_async
    def increment_download_count(self, file_url):
        try:
            filename = file_url.split('/')[-1]
            file_upload = FileUpload.objects.get(file__contains=filename)
            
            if hasattr(file_upload, 'download_count'):
                file_upload.download_count += 1
                file_upload.save(update_fields=["download_count"])
            
            return True
        except FileUpload.DoesNotExist:
            logger.error(f"File not found for URL: {file_url}")
            return False
        except Exception as e:
            logger.error(f"Error incrementing download count: {e}")
            return False


    @database_sync_to_async
    def get_room(self, room_id):
        try:
            return Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            return None


    def get_file_type(self, file_name):
        if not file_name:
            return 'file'
    
        extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
    
        if extension in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            return 'image'
        elif extension in ['mp4', 'avi', 'mov', 'wmv']:
            return 'video'
        elif extension in ['mp3', 'wav', 'ogg', 'flac']:
            return 'audio'
        elif extension == 'pdf':
            return 'pdf'
        elif extension in ['doc', 'docx']:
            return 'document'
        elif extension in ['xls', 'xlsx']:
            return 'spreadsheet'
        elif extension in ['zip', 'rar']:
            return 'archive'
        elif extension in ['txt']:
            return 'text'
        else:
            return 'file'


    def format_file_size(self, size_bytes):
        if size_bytes == 0:
            return "0B"
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names)-1:
            size_bytes /= 1024.0
            i += 1
        return f"{size_bytes:.1f}{size_names[i]}"


class VideoCallConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'videocall_{self.room_id}'
        self.user = self.scope['user']

        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.channel_layer.group_add(f"user_{self.user.id}", self.channel_name)

        await self.accept()
        print(f"[VideoCall] User {self.user.id} connected to room {self.room_id}")

    async def disconnect(self, close_code):
        try:
            if hasattr(self.user, 'id') and not isinstance(self.user, AnonymousUser):
                user_name = getattr(self.user, 'fullname', None) or getattr(self.user, 'username', 'Unknown User')

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_left',
                        'user_id': self.user.id,
                        'user_name': user_name
                    }
                )

        except Exception as e:
            print(f"[VideoCall] Error in disconnect: {e}")
        finally:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            user_name = getattr(self.user, 'fullname', None) or getattr(self.user, 'username', 'Unknown User')

            if message_type == 'offer':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'offer',
                        'offer': data['offer'],
                        'from_user_id': self.user.id,
                        'from_user_name': user_name
                    }
                )
            elif message_type == 'answer':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'answer',
                        'answer': data['answer'],
                        'from_user_id': self.user.id
                    }
                )
            elif message_type == 'ice_candidate':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'ice_candidate',
                        'candidate': data['candidate'],
                        'from_user_id': self.user.id
                    }
                )

            elif message_type == 'join_call':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_joined',
                        'user_id': self.user.id,
                        'user_name': user_name
                    }
                )

            elif message_type == 'leave_call':
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_left',
                        'user_id': self.user.id,
                        'user_name': user_name
                    }
                )

            elif message_type == 'call_invitation':
                to_user_id = data.get('to_user_id')
                if to_user_id:
                    await self.channel_layer.group_send(
                        f"user_{to_user_id}",   
                        {
                            'type': 'call_invitation',
                            'room_id': data['room_id'],
                            'from_user_id': self.user.id,
                            'from_user_name': user_name,
                            'call_type': data.get('call_type', 'video')
                        }
                    )
                    print(f"[VideoCall] Call invitation sent to user_{to_user_id}")
                else:
                    print("[VideoCall] Error: to_user_id missing in call_invitation")

            elif message_type == 'call_response':
                to_user_id = data.get('to_user_id')
                if to_user_id:
                    await self.channel_layer.group_send(
                        f"user_{to_user_id}",       
                        {
                            'type': 'call_response',
                            'room_id': data['room_id'],
                            'from_user_id': self.user.id,
                            'from_user_name': user_name,
                            'accepted': data['accepted']
                        }
                    )
                    print(f"[VideoCall] Call response sent to user_{to_user_id}")
                else:
                    print("[VideoCall] Error: to_user_id missing in call_response")

        except Exception as e:
            print(f"[VideoCall] Error in receive: {e}")

    async def offer(self, event):
        if self.user.id != event['from_user_id']:
            await self.send_json(event)

    async def answer(self, event):
        if self.user.id != event['from_user_id']:
            await self.send_json(event)

    async def ice_candidate(self, event):
        if self.user.id != event['from_user_id']:
            await self.send_json(event)

    async def user_joined(self, event):
        if self.user.id != event['user_id']:
            await self.send_json(event)

    async def user_left(self, event):
        if self.user.id != event['user_id']:
            await self.send_json(event)

    async def call_invitation(self, event):
        await self.send_json({
            'type': 'call_invitation',
            'room_id': event['room_id'],
            'from_user_id': event['from_user_id'],
            'from_user_name': event['from_user_name'],
            'call_type': event['call_type']
        })

    async def call_response(self, event):
        await self.send_json({
            'type': 'call_response',
            'room_id': event['room_id'],
            'from_user_id': event['from_user_id'],
            'from_user_name': event['from_user_name'],
            'accepted': event['accepted']
        })
