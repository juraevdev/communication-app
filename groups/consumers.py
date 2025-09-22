import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from groups.models import Group, GroupMember, GroupMessage
from accounts.models import CustomUser
from groups.serializers import GroupMessageSerializer


class GroupChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.group_room_name = f'group_{self.group_id}'
        self.user = self.scope['user']

        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        is_member = await self.check_group_membership()
        if not is_member:
            await self.close()
            return

        await self.accept()

        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'initial_unread_count',
            'count': unread_count
        }))

        await self.channel_layer.group_add(
            self.group_room_name,
            self.channel_name
        )

        await self.set_user_online(True)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_room_name'):
            await self.channel_layer.group_discard(
                self.group_room_name,
                self.channel_name
            )

        if hasattr(self, 'user') and not isinstance(self.user, AnonymousUser):
            await self.set_user_online(False)

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'chat_message')
    
            if message_type == 'chat_message':
                await self.handle_chat_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'stop_typing':
                await self.handle_stop_typing(text_data_json)
            elif message_type == 'get_history':
                await self.send_message_history()
            elif message_type == 'file_upload':
                await self.handle_file_upload(text_data_json)
            elif message_type == 'mark_as_read':  
                await self.handle_mark_as_read(text_data_json)
            elif message_type == 'get_unread_count': 
                await self.send_unread_count()
            elif message_type == 'mark_all_as_read':
                await self.handle_mark_all_as_read()
            
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
            
    async def handle_mark_all_as_read(self):
        await self.mark_all_messages_as_read()
        await self.send_unread_count()
            
    async def handle_mark_as_read(self, data):
        message_id = data.get('message_id')
        await self.mark_message_as_read(message_id)

    async def mark_message_as_read(self, message_id):
        if message_id:
            await self.set_message_read_status(message_id, True)
            await self.channel_layer.group_send(
                self.group_room_name,
                {
                    'type': 'message_read',
                    'message_id': message_id,
                    'user_id': self.user.id,
                    'user_name': self.user.fullname,
                }
            )

    async def message_read(self, event):
        if event['user_id'] == self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'unread_count_decrement',
                'count': 1
            }))
    
        await self.send(text_data=json.dumps({
            'type': 'read',
            'message_id': event['message_id'],
            'user_id': event['user_id'],
            'user_name': event['user_name'],
        }))

    async def send_unread_count(self):
        unread_count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': unread_count
        }))

    async def handle_chat_message(self, data):
        content = data.get('message', '')
        reply_to_id = data.get('reply_to', None)
        
        if not content.strip():
            return

        message = await self.save_message(content, reply_to_id)
        
        if message:
            await self.channel_layer.group_send(
                self.group_room_name,
                {
                    'type': 'chat_message',
                    'message': await self.serialize_message(message),
                    'sender_id': self.user.id,
                    'sender_name': self.user.fullname,
                    'timestamp': message.created_at.isoformat(),
                    'reply_to': await self.get_reply_message(reply_to_id) if reply_to_id else None
                }
            )

    async def handle_typing(self, data):
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'user_typing',
                'user_id': self.user.id,
                'user_name': self.user.fullname,
            }
        )

    async def handle_stop_typing(self, data):
        await self.channel_layer.group_send(
            self.group_room_name,
            {
                'type': 'user_stop_typing',
                'user_id': self.user.id,
                'user_name': self.user.fullname,
            }
        )

    async def chat_message(self, event):
        if event['sender_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'unread_count_increment',
                'count': 1
            }))
    
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'timestamp': event['timestamp'],
            'reply_to': event['reply_to']
        }))

    async def user_typing(self, event):
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'user_name': event['user_name'],
            }))

    async def user_stop_typing(self, event):
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'stop_typing',
                'user_id': event['user_id'],
                'user_name': event['user_name'],
            }))

    async def member_joined(self, event):
        await self.send(text_data=json.dumps({
            'type': 'member_joined',
            'user': event['user'],
            'message': f"{event['user']['fullname']} guruhga qo'shildi"
        }))

    async def member_left(self, event):
        await self.send(text_data=json.dumps({
            'type': 'member_left',
            'user_id': event['user_id'],
            'user_name': event['user_name'],
            'message': f"{event['user_name']} guruhdan chiqdi"
        }))

    async def role_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'role_updated',
            'user_id': event['user_id'],
            'user_name': event['user_name'],
            'new_role': event['new_role'],
            'message': f"{event['user_name']} roli {event['new_role']} ga o'zgartirildi"
        }))
        
    async def send_message_history(self):
        messages = await self.get_group_messages()
        await self.send(text_data=json.dumps({
            'type': 'message_history',
            'messages': messages
        }))
        
    async def handle_file_upload(self, data):
        file_data = data.get('file_data')
        file_name = data.get('file_name')
        file_type = data.get('file_type')

        if not file_data or not file_name:
            return

        file_message = await self.save_file_message(file_name, file_type, file_data)

        if file_message:
            await self.channel_layer.group_send(
                self.group_room_name,
                {
                    'type': 'file_message',
                    'file_id': file_message.id,
                    'file_name': file_message.file.original_filename if file_message.file else file_name,
                    'file_url': file_message.file.file.url if file_message.file else '',
                    'file_type': file_type,
                    'file_size': file_message.file.file.size if file_message.file else 0,
                    'sender_id': self.user.id,
                    'sender_name': self.user.fullname,
                    'timestamp': file_message.created_at.isoformat(),
                }
            )

    async def file_message(self, event):
        if event['sender_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'unread_count_increment',
                'count': 1
            }))
    
        await self.send(text_data=json.dumps({
            'type': 'file_uploaded',
            'id': event['file_id'],
            'file_name': event['file_name'],
            'file_url': event['file_url'],
            'file_type': event['file_type'],
            'file_size': event['file_size'],
            'user': {
                'id': event['sender_id'],
                'fullname': event['sender_name']
            },
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'timestamp': event['timestamp'],
            'uploaded_at': event['timestamp'],
            'message_type': 'file'
        }))
        
        
    @database_sync_to_async
    def save_file_message(self, file_name, file_type, base64_data):
        try:
            from django.core.files.base import ContentFile
            import base64
            from groups.models import FileUpload
            import uuid
            import os

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
                group_id=self.group_id,
                file=file_content,
                original_filename=file_name
            )

            file_message = GroupMessage.objects.create(
                group_id=self.group_id,
                sender=self.user,
                content=f"File: {file_name}",
                file=file_upload,
                message_type='file'
            )
        
            file_url = file_upload.file.url
            if not file_url.startswith('http'):
                from django.conf import settings
                file_url = f"{settings.BASE_URL}{file_url}"

            return file_message
        except Exception as e:
            print(f"Error saving file: {e}")
            return None
    

    @database_sync_to_async
    def check_group_membership(self):
        try:
            GroupMember.objects.get(group_id=self.group_id, user=self.user)
            return True
        except GroupMember.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content, reply_to_id=None):
        try:
            reply_to = None
            if reply_to_id:
                reply_to = GroupMessage.objects.get(id=reply_to_id, group_id=self.group_id)

            message = GroupMessage.objects.create(
                group_id=self.group_id,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            return message
        except Exception:
            return None

    @database_sync_to_async
    def serialize_message(self, message):
        serializer = GroupMessageSerializer(message)
        return serializer.data

    @database_sync_to_async
    def get_reply_message(self, reply_to_id):
        try:
            message = GroupMessage.objects.get(id=reply_to_id, group_id=self.group_id)
            serializer = GroupMessageSerializer(message)
            return serializer.data
        except GroupMessage.DoesNotExist:
            return None

    @database_sync_to_async
    def set_user_online(self, is_online):
        from django.utils import timezone
        if not isinstance(self.user, AnonymousUser):
            self.user.is_online = is_online
            if not is_online:
                self.user.last_seen = timezone.now()
            self.user.save()
            
    
    @database_sync_to_async
    def get_group_messages(self):
        messages = GroupMessage.objects.filter(group_id=self.group_id).select_related('sender', 'reply_to', 'file').order_by('created_at')
    
        result = []
        for msg in messages:
            message_data = {
                'id': msg.id,
                'content': msg.content,
                'sender_id': msg.sender.id,
                'sender_fullname': msg.sender.fullname,
                'created_at': msg.created_at.isoformat(),
                'message_type': msg.message_type,
                'is_updated': False,
            }
        
            if msg.file:
                message_data.update({
                    'file_name': msg.file.original_filename,
                    'file_url': msg.file.file.url if msg.file.file else '',
                    'file_type': 'file',  
                    'file_size': msg.file.file.size if msg.file.file else 0,
                })
        
            result.append(message_data)
    
        return result


    @database_sync_to_async
    def set_message_read_status(self, message_id, is_read):
        try:
            message = GroupMessage.objects.get(id=message_id, group_id=self.group_id)
            if message.sender != self.user:  
                message.is_read = is_read
                message.save()
                return True
        except GroupMessage.DoesNotExist:
            pass
        return False


    @database_sync_to_async
    def get_unread_count(self):
        return GroupMessage.objects.filter(
            group_id=self.group_id,
            is_read=False
        ).exclude(sender=self.user).count()
        
    
    @database_sync_to_async
    def mark_all_messages_as_read(self):
        GroupMessage.objects.filter(
            group_id=self.group_id,
            is_read=False
        ).exclude(sender=self.user).update(is_read=True)