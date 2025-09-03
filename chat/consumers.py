import json
import base64
import logging

from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.utils import timezone
from django.core.exceptions import ValidationError, ObjectDoesNotExist

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


class StatusConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if user.is_anonymous:
            await self.close()
        else:
            await set_user_online_status(user, True)
            await self.channel_layer.group_add("status", self.channel_name)
            await self.accept()
            await self.channel_layer.group_send(
                "status",
                {
                    "type": "status_update",
                    "user_id": user.id,
                    "status": "online",
                    "timestamp": str(timezone.now())
                }
            )


    async def disconnect(self, code):
        user = self.scope["user"]
        await set_user_online_status(user, False)  # ✅ offline qilamiz
        await self.channel_layer.group_discard("status", self.channel_name)
        await self.channel_layer.group_send(
            "status",
            {
                "type": "status_update",
                "user_id": user.id,
                "status": "offline",
                "timestamp": str(timezone.now())
            }
        )


    async def status_update(self, event):
        await self.send_json({
            "type": "status_update",
            "user_id": event["user_id"],
            "status": event["status"],
            "timestamp": event["timestamp"]
        })



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
        except Exception as e:
            logger.error(f"Error leaving group {self.room_group_name}: {e}")


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
        
        action_handler = getattr(self, f'handle_{action}', None)
        if action_handler:
            await action_handler(content)
        else:
            await self.send_error(
                "Invalid action. Choose from: send, read, delete, edit, upload_file, read_file, delete_file", 
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
                **message_data
            }
        )

    async def handle_read(self, content):
        message_id = content.get('message_id')
        if not message_id:
            await self.send_error("message_id is required", 'id_required')
            return
        
        success = await self.mark_message_as_read(message_id)
        if success:
            await self.send_success('Message marked as read')
        else:
            await self.send_error('Failed to mark message as read', 'mark_error')

    async def handle_delete(self, content):
        message_id = content.get("message_id")
        if not message_id:
            await self.send_error("message_id required", 'id_required')
            return
        
        success = await self.delete_message(message_id)
        if success:
            await self.send_success('Message deleted')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "message_deleted",
                    "message_id": message_id,
                    "user_id": self.user.id
                }
            )
        else:
            await self.send_error("You cannot delete this message", 'permission_error')

    async def handle_edit(self, content):
        message_id = content.get('message_id')
        new_message = content.get('new_message')
        
        if not message_id or not new_message:
            await self.send_error('message_id and new_message are required', 'params_required')
            return
        
        message = await self.edit_message(message_id, new_message)
        if message:
            message_data = await self.get_message_data(message.id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    **message_data
                }
            )
        else:
            await self.send_error('You cannot edit this message', 'permission_error')

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
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "file_uploaded",
                    **file_info
                }
            )
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
        else:
            await self.send_error("You cannot delete this file", 'permission_error')

    async def chat_message(self, event):
        await self.send_json({
            'type': 'new_message',
            'id': event['id'],
            "message": event['message'],
            'sender': event['sender'],
            'is_updated': event['is_updated'],
            'is_read': event['is_read'],
            'timestamp': event['timestamp']
        })

    async def message_deleted(self, event):
        await self.send_json({
            'type': 'message_deleted',
            'message_id': event['message_id'],
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
                    "full_name": message.sender.fullname
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
            messages = Message.objects.filter(
                room=self.room
            ).select_related('sender').order_by('-timestamp')[:limit]
            
            return [
                {
                    "id": str(msg.id),
                    "message": msg.text,
                    'sender': {
                        "id": str(msg.sender.id),
                        "email": msg.sender.email,
                        "full_name": msg.sender.fullname
                    },
                    "is_read": msg.is_read,
                    "is_updated": msg.is_updated,
                    "timestamp": str(msg.timestamp),
                }
                for msg in messages
            ]
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
            message.is_read = True
            message.save(update_fields=["is_read"])
            return True
        except Message.DoesNotExist:
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
    def edit_message(self, message_id, new_message):
        try:
            message = Message.objects.get(
                id=message_id, 
                room=self.room, 
                sender=self.user
            )
            message.text = new_message.strip()
            message.is_updated = True
            message.save(update_fields=["text", "is_updated"])
            return message
        except Message.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error editing message: {e}")
            return None

    @database_sync_to_async
    def save_file(self, file_data, file_name, file_type=None):
        try:
            if ';base64,' not in file_data:
                return None
                
            format, file_str = file_data.split(';base64,')
            file_bytes = base64.b64decode(file_str)
            
            file_content = ContentFile(file_bytes, name=file_name)
            
            recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
            
            file_upload = FileUpload.objects.create(
                user=self.user,
                file=file_content,
                room=self.room,
                recipient=recipient
            )
            
            return file_upload
        except Exception as e:
            print(f"File upload error: {e}")
            return None

    @database_sync_to_async
    def get_file_data(self, file_upload_id):
        try:
            file_upload = FileUpload.objects.select_related('user').get(id=file_upload_id)
            return {
                'id': str(file_upload.id),
                'file_name': file_upload.file.name,
                'file_url': file_upload.file.url,
                'user': {
                    'id': str(file_upload.user.id),
                    'email': file_upload.user.email,
                    'full_name': file_upload.user.fullname
                },
                'uploaded_at': str(file_upload.uploaded_at)
            }
        except FileUpload.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting file data: {e}")
            return None

    @database_sync_to_async
    def mark_file_as_read(self, file_id):
        try:
            file_upload = FileUpload.objects.get(
                id=file_id,
                recipient=self.user
            )
            file_upload.is_read = True
            file_upload.save()
            return True
        except FileUpload.DoesNotExist:
            return False
        
        except FileUpload.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error marking file as read: {e}")
            return False

    @database_sync_to_async
    def delete_file(self, file_id):
        try:
            file_upload = FileUpload.objects.get(id=file_id)
        
            if file_upload.user == self.user:
                file_upload.delete()
                return True
        
            return False
        
        except FileUpload.DoesNotExist:
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {e}")
            return False


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