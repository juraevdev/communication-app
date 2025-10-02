import json
import base64
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


class ChannelConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.channel_id = self.scope['url_route']['kwargs']['channel_id']
        self.channel_room_name = f'channel_{self.channel_id}'
        self.user = self.scope['user']

        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        is_subscriber_or_owner = await self.check_channel_access()
        if not is_subscriber_or_owner:
            await self.close()
            return

        await self.accept()

        await self.channel_layer.group_add(
            self.channel_room_name,
            self.channel_name
        )

        await self.send_message_history()

    async def disconnect(self, close_code):
        if hasattr(self, 'channel_room_name'):
            await self.channel_layer.group_discard(
                self.channel_room_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action', '')

            if action == 'send_message':
                await self.handle_send_message(data)
            elif action == 'upload_file':
                await self.handle_file_upload(data)
            elif action == 'get_history':
                await self.send_message_history()
            elif action == 'mark_as_read':
                await self.handle_mark_as_read(data)
            elif action == 'get_unread_count':
                await self.send_unread_count()
            elif action == 'delete_message':  # ✅ Xabarlarni o'chirish
                await self.handle_delete_message(data)
            elif action == 'edit_message':    # ✅ Xabarlarni tahrirlash
                await self.handle_edit_message(data)
            elif action == 'delete_file':     # ✅ Fayllarni o'chirish uchun yangi action
                await self.handle_delete_file(data)
            else:
                await self.send(text_data=json.dumps({
                    'error': 'Invalid action'
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in channel receive: {e}")
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def handle_send_message(self, data):
        content = data.get('message', '').strip()

        if not content:
            return

        is_owner = await self.check_channel_owner()
        if not is_owner:
            await self.send(text_data=json.dumps({
                'error': 'Only channel owner can send messages'
            }))
            return

        message = await self.save_message(content)

        if message:
            await self.update_channel_timestamp()
        
            message_data = await self.serialize_message(message)
        
            await self.channel_layer.group_send(
                self.channel_room_name,
                {
                    'type': 'chat_message',
                    'message': message_data
                }
            )

    async def handle_file_upload(self, data):
        is_owner = await self.check_channel_owner()
        if not is_owner:
            await self.send(text_data=json.dumps({
                'error': 'Only channel owner can upload files'
            }))
            return

        file_data = data.get('file_data')
        file_name = data.get('file_name')
        file_type = data.get('file_type')
        file_size = data.get('file_size', 0)

        if not file_data or not file_name:
            await self.send(text_data=json.dumps({
                'error': 'file_data and file_name are required'
            }))
            return

        file_message = await self.save_file_message(file_name, file_type, file_data, file_size)

        if file_message:
            message_data = await self.serialize_message(file_message)
            
            await self.channel_layer.group_send(
                self.channel_room_name,
                {
                    'type': 'file_uploaded',
                    'message': message_data
                }
            )
        else:
            await self.send(text_data=json.dumps({
                'error': 'Failed to upload file'
            }))

    async def handle_mark_as_read(self, data):
        message_id = data.get('message_id')
        if not message_id:
            return

        success = await self.mark_message_as_read(message_id)
        
        if success:
            unread_count = await self.get_unread_count()
            await self.send(text_data=json.dumps({
                'type': 'message_read',
                'message_id': message_id,
                'unread_count': unread_count
            }))

    async def send_unread_count(self):
        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': unread_count
        }))

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message']
        }))

    async def file_uploaded(self, event):
        await self.send(text_data=json.dumps({
            'type': 'file_uploaded',
            'message': event['message']
        }))

    async def send_message_history(self):
        messages = await self.get_channel_messages()
        await self.send(text_data=json.dumps({
            'type': 'message_history',
            'messages': messages
        }))
        
        
    async def handle_edit_message(self, data):
        message_id = data.get('message_id')
        new_content = data.get('new_content')

        if not message_id or not new_content:
            await self.send(text_data=json.dumps({
                'error': 'message_id and new_content are required'
            }))
            return

        is_owner = await self.check_channel_owner()
        if not is_owner:
            await self.send(text_data=json.dumps({
                'error': 'Only channel owner can edit messages'
            }))
            return

        success = await self.edit_message(message_id, new_content)
        if success:
            await self.channel_layer.group_send(
                self.channel_room_name,
                {
                    'type': 'message_updated',
                    'message_id': message_id,
                    'new_content': new_content
                }
            )
        else:
            await self.send(text_data=json.dumps({
                'error': 'Failed to edit message'
            }))

    async def handle_delete_message(self, data):
        message_id = data.get('message_id')
        if not message_id:
            await self.send(text_data=json.dumps({
                'error': 'message_id is required'
            }))
            return

        is_owner = await self.check_channel_owner()
        if not is_owner:
            await self.send(text_data=json.dumps({
                'error': 'Only channel owner can delete messages'
            }))
            return

        success = await self.delete_message(message_id)
        if success:
            await self.channel_layer.group_send(
                self.channel_room_name,
                {   
                    'type': 'message_deleted',
                    'message_id': message_id
                }
            )
        else:
            await self.send(text_data=json.dumps({
                'error': 'Failed to delete message'
            }))
            
    async def handle_delete_file(self, data):
        file_id = data.get('file_id')
        if not file_id:
            await self.send(text_data=json.dumps({
                'error': 'file_id is required'
            }))
            return

        is_owner = await self.check_channel_owner()
        if not is_owner:
            await self.send(text_data=json.dumps({
                'error': 'Only channel owner can delete files'
            }))
            return

        success = await self.delete_file_message(file_id)
        if success:
            await self.channel_layer.group_send(
                self.channel_room_name,
                {   
                    'type': 'file_deleted',
                    'file_id': file_id
                }
            )
        else:
            await self.send(text_data=json.dumps({
                'error': 'Failed to delete file'
            }))
            
    async def file_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'file_deleted',
            'file_id': event['file_id']
        }))

    async def message_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_updated',
            'message_id': event['message_id'],
            'new_content': event['new_content']
        }))

    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id']
        }))

    @database_sync_to_async
    def edit_message(self, message_id, new_content):
        from channel.models import ChannelMessage
    
        try:
            message = ChannelMessage.objects.get(
                id=message_id,
                channel_id=self.channel_id,
                user=self.user
            )
        
            message.content = new_content.strip()
            message.is_updated = True
            message.save(update_fields=["content", "is_updated"])
        
            return True
        except ChannelMessage.DoesNotExist:
            return False
        
    @database_sync_to_async
    def delete_file_message(self, file_id):
        from channel.models import ChannelMessage
        from chat.models import FileUpload
    
        try:
            message = ChannelMessage.objects.get(
                id=file_id,
                channel_id=self.channel_id,
                user=self.user,
                message_type='file'  # Faqat fayl xabarlarini o'chirish
            )
        
            if message.file:
                file_upload = message.file
                file_upload.file.delete()  # Faylni fayl tizimidan o'chiradi
                file_upload.delete()       # FileUpload obyektini o'chiradi
        
            message.delete()
            return True
        
        except ChannelMessage.DoesNotExist:
            logger.error(f"File message {file_id} not found in channel {self.channel_id}")
            return False
        except Exception as e:
            logger.error(f"Error deleting file message: {e}")
            return False

    @database_sync_to_async
    def delete_message(self, message_id):
        from channel.models import ChannelMessage
    
        try:
            message = ChannelMessage.objects.get(
                id=message_id,
                channel_id=self.channel_id,
                user=self.user
            )
            message.delete()
            return True
        except ChannelMessage.DoesNotExist:
            return False
       

    @database_sync_to_async
    def check_channel_access(self):
        from channel.models import Channel
        
        try:
            channel = Channel.objects.get(id=self.channel_id)
            
            if channel.owner_id == self.user.id:
                return True
            
            return channel.members.filter(id=self.user.id).exists()
            
        except Channel.DoesNotExist:
            return False

    @database_sync_to_async
    def check_channel_owner(self):
        from channel.models import Channel
        
        try:
            channel = Channel.objects.get(id=self.channel_id)
            return channel.owner_id == self.user.id
        except Channel.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content):
        from channel.models import ChannelMessage
        
        try:
            message = ChannelMessage.objects.create(
                channel_id=self.channel_id,
                user=self.user,
                content=content,
                message_type='text'
            )
            return message
        except Exception as e:
            logger.error(f"Error saving channel message: {e}")
            return None

    @database_sync_to_async
    def save_file_message(self, file_name, file_type, base64_data, file_size):
        from channel.models import ChannelMessage
        from chat.models import FileUpload
        import uuid
        import os
        
        try:
            if ';base64,' in base64_data:
                format, file_str = base64_data.split(';base64,')
            else:
                file_str = base64_data

            file_data = base64.b64decode(file_str)

            file_extension = os.path.splitext(file_name)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"

            file_content = ContentFile(file_data, name=unique_filename)

            file_upload = FileUpload.objects.create(
                user=self.user,
                channel_id=self.channel_id,
                file=file_content,
                original_filename=file_name
            )

            message = ChannelMessage.objects.create(
                channel_id=self.channel_id,
                user=self.user,
                content=f"File: {file_name}",
                message_type='file',
                file=file_upload
            )

            return message

        except Exception as e:
            logger.error(f"Error saving channel file: {e}")
            return None

    @database_sync_to_async
    def serialize_message(self, message):
        from channel.models import Channel
    
        print(f"[DEBUG] Serializing message: message_user_id={message.user.id}, current_user_id={self.user.id}, channel_id={self.channel_id}")
    
        is_channel_owner = False
        can_edit = False
        can_delete = False
    
        try:
            channel = Channel.objects.get(id=self.channel_id)
            is_channel_owner = channel.owner_id == self.user.id
        
            can_edit = is_channel_owner
            can_delete = is_channel_owner
        
            print(f"[DEBUG] Channel check: channel_owner_id={channel.owner_id}, current_user_id={self.user.id}, is_channel_owner={is_channel_owner}")
        
        except Channel.DoesNotExist:
            print(f"[DEBUG] Channel {self.channel_id} not found")
            pass
    
        is_own_message = message.user.id == self.user.id
    
        result = {
            'id': message.id,
            'content': message.content,
            'user': {
                'id': str(message.user.id),
                'fullname': message.user.fullname,
                'email': message.user.email
            },
            'created_at': message.created_at.isoformat(),
            'message_type': message.message_type,
            'is_updated': message.is_updated,
            'is_read': message.is_read,
            'is_own': is_own_message,   
            'is_channel_owner': is_channel_owner,   
            'can_edit': can_edit,   
            'can_delete': can_delete,   
        }
    
        if message.file:
            result['file'] = {
                'name': message.file.original_filename,
                'url': message.file.file_url,
                'size': message.file.file.size if message.file.file else 0,
                'type': message.message_type
            }

        print(f"[DEBUG] Final result: is_own={is_own_message}, is_channel_owner={is_channel_owner}, can_edit={can_edit}, can_delete={can_delete}")
        return result

    @database_sync_to_async
    def get_channel_messages(self):
        from channel.models import ChannelMessage, Channel
    
        messages = ChannelMessage.objects.filter(
            channel_id=self.channel_id
        ).prefetch_related('read_by').select_related('user', 'file').order_by('created_at')

        result = []
    
        try:
            channel = Channel.objects.get(id=self.channel_id)
            is_current_user_channel_owner = channel.owner_id == self.user.id
            print(f"[DEBUG] Current user is channel owner: {is_current_user_channel_owner}")
        except Channel.DoesNotExist:
            is_current_user_channel_owner = False
            print(f"[DEBUG] Channel {self.channel_id} not found")

        for msg in messages:
            is_read_by_user = self.user in msg.read_by.all() or msg.user == self.user
        
            is_channel_owner = is_current_user_channel_owner
            can_edit = is_current_user_channel_owner
            can_delete = is_current_user_channel_owner

            message_data = {
                'id': msg.id,
                'content': msg.content,
                'user': {
                    'id': str(msg.user.id),
                    'fullname': msg.user.fullname,
                    'email': msg.user.email
                },
                'created_at': msg.created_at.isoformat(),
                'message_type': msg.message_type,
                'is_updated': msg.is_updated,
                'is_read': is_read_by_user,
                'is_own': msg.user.id == self.user.id,      
                'is_channel_owner': is_channel_owner,   
                'can_edit': can_edit,   
                'can_delete': can_delete,   
            }

            if msg.file:
                message_data['file'] = {
                    'name': msg.file.original_filename,
                    'url': msg.file.file_url,
                    'size': msg.file.file.size if msg.file.file else 0,
                    'type': msg.message_type
                }

            print(f"[DEBUG] Message {msg.id}: is_own={message_data['is_own']}, is_channel_owner={is_channel_owner}")
            result.append(message_data)

        return result

    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        from channel.models import ChannelMessage
        
        try:
            message = ChannelMessage.objects.get(
                id=message_id,
                channel_id=self.channel_id
            )
            
            if message.user != self.user:
                message.is_read = True
                message.save()
            
            return True
        except ChannelMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def get_unread_count(self):
        from channel.models import ChannelMessage
    
        return ChannelMessage.objects.filter(
            channel_id=self.channel_id
        ).exclude(
            user=self.user  
        ).exclude(
            read_by=self.user   
        ).count()
        
        
    @database_sync_to_async
    def update_channel_timestamp(self):
        from channel.models import Channel
        from django.utils import timezone
    
        try:
            channel = Channel.objects.get(id=self.channel_id)
            channel.updated_at = timezone.now()
            channel.save(update_fields=['updated_at'])
        except Channel.DoesNotExist:
            pass