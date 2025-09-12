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

        await self.channel_layer.group_add(
            self.group_room_name,
            self.channel_name
        )

        await self.accept()

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
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
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
        await self.send(text_data=json.dumps({
            'type': 'message',
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