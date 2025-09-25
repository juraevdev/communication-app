import json
import base64
from django.core.files.base import ContentFile
from django.db import models
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Channel, ChannelMessage, FileUpload


class ChannelConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.channel_id = self.scope['url_route']['kwargs']['channel_id']
        self.channel_group_name = f'channel_{self.channel_id}'
        self.user = self.scope['user']

        # faqat authenticated user
        if isinstance(self.user, AnonymousUser):
            await self.close()
            return

        # owner yoki member ekanini tekshir
        if not await self.is_channel_member():
            await self.close()
            return

        await self.channel_layer.group_add(
            self.channel_group_name,
            self.channel_name
        )
        await self.accept()

        unread_count = await self.get_unread_count()
        await self.send_json({
            'type': 'initial_unread_count',
            'count': unread_count
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'channel_group_name'):
            await self.channel_layer.group_discard(
                self.channel_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'send_message':
            await self.send_message(data)
        elif action == 'edit_message':
            await self.edit_message(data)
        elif action == 'delete_message':
            await self.delete_message(data)
        elif action == 'mark_as_read':
            await self.mark_message_as_read(data)
        elif action == 'get_history':
            await self.send_message_history()
        elif action == 'upload_file':
            await self.upload_file(data)
        elif action == 'get_unread_count':
            await self.send_unread_count()

    # --------------- actions ----------------
    async def send_message(self, data):
        message_text = data.get('message', '')
        message_type = data.get('message_type', 'text')
        reply_to = data.get('reply_to')

        message = await self.create_message(message_text, message_type, reply_to)

        if message:
            unread_count = await self.get_unread_count()
            await self.channel_layer.group_send(
                self.channel_group_name,
                {
                    'type': 'chat_message',
                    'action': 'new_message',
                    'message': await self.message_to_dict(message),
                    'unread_count': unread_count
                }
            )

    async def edit_message(self, data):
        message_id = data.get('message_id')
        new_text = data.get('new_message')

        message = await self.update_message(message_id, new_text)
        if message:
            await self.channel_layer.group_send(
                self.channel_group_name,
                {
                    'type': 'chat_message',
                    'action': 'message_edited',
                    'message': await self.message_to_dict(message)
                }
            )

    async def delete_message(self, data):
        message_id = data.get('message_id')
        success = await self.delete_message_from_db(message_id)
        if success:
            await self.channel_layer.group_send(
                self.channel_group_name,
                {
                    'type': 'chat_message',
                    'action': 'message_deleted',
                    'message_id': message_id
                }
            )

    async def mark_message_as_read(self, data):
        message_id = data.get('message_id')
        await self.mark_message_read(message_id)
        unread_count = await self.get_unread_count()

        await self.channel_layer.group_send(
            self.channel_group_name,
            {
                'type': 'chat_message',
                'action': 'message_read',
                'message_id': message_id,
                'unread_count': unread_count
            }
        )

    async def send_message_history(self):
        messages = await self.get_channel_messages()
        await self.send_json({
            'type': 'message_history',
            'messages': messages
        })

    async def send_unread_count(self):
        unread_count = await self.get_unread_count()
        await self.send_json({
            'type': 'unread_count',
            'count': unread_count
        })

    async def upload_file(self, data):
        file_data = data.get('file_data')
        file_name = data.get('file_name')
        file_type = data.get('file_type')

        file_upload = await self.create_file_upload(file_data, file_name)
        if file_upload:
            message = await self.create_message(
                message_text=file_name,
                message_type='file',
                file_upload=file_upload
            )
            if message:
                unread_count = await self.get_unread_count()
                await self.channel_layer.group_send(
                    self.channel_group_name,
                    {
                        'type': 'chat_message',
                        'action': 'file_uploaded',
                        'message': await self.message_to_dict(message),
                        'file_info': {
                            'id': file_upload.id,
                            'name': file_upload.file.name,
                            'url': file_upload.file.url,
                            'size': file_upload.file.size,
                            'type': file_type,
                        },
                        'unread_count': unread_count
                    }
                )

    async def chat_message(self, event):
        await self.send_json(event)

    # --------------- db helpers ----------------
    @database_sync_to_async
    def is_channel_member(self):
        return Channel.objects.filter(
            id=self.channel_id
        ).filter(
            models.Q(owner=self.user) | models.Q(members=self.user)
        ).exists()

    @database_sync_to_async
    def create_message(self, message_text, message_type, reply_to=None, file_upload=None):
        try:
            channel = Channel.objects.get(id=self.channel_id)
            return ChannelMessage.objects.create(
                user=self.user,
                channel=channel,
                context=message_text,
                file=file_upload,
                message_type=message_type
            )
        except Exception:
            return None

    @database_sync_to_async
    def update_message(self, message_id, new_text):
        try:
            message = ChannelMessage.objects.get(
                id=message_id, user=self.user, channel_id=self.channel_id
            )
            message.context = new_text
            message.is_updated = True
            message.save(update_fields=["context", "is_updated"])
            return message
        except ChannelMessage.DoesNotExist:
            return None

    @database_sync_to_async
    def delete_message_from_db(self, message_id):
        try:
            message = ChannelMessage.objects.get(
                id=message_id, user=self.user, channel_id=self.channel_id
            )
            message.delete()
            return True
        except ChannelMessage.DoesNotExist:
            return False

    @database_sync_to_async
    def mark_message_read(self, message_id):
        try:
            message = ChannelMessage.objects.get(id=message_id, channel_id=self.channel_id)
            message.is_read = True
            message.save(update_fields=["is_read"])
        except ChannelMessage.DoesNotExist:
            pass

    @database_sync_to_async
    def get_unread_count(self):
        return ChannelMessage.objects.filter(
            channel_id=self.channel_id,
            is_read=False
        ).exclude(user=self.user).count()

    @database_sync_to_async
    def get_channel_messages(self, limit=50):
        messages = ChannelMessage.objects.filter(
            channel_id=self.channel_id
        ).select_related('user', 'file').order_by('-created_at')[:limit]

        return [
            {
                'id': msg.id,
                'user': {
                    'id': msg.user.id,
                    'username': msg.user.username,
                    'fullname': msg.user.get_full_name(),
                },
                'content': msg.context,
                'message_type': msg.message_type,
                'file': {
                    'id': msg.file.id,
                    'name': msg.file.file.name,
                    'url': msg.file.file.url,
                    'size': msg.file.file.size,
                } if msg.file else None,
                'created_at': msg.created_at.isoformat(),
                'is_read': msg.is_read,
                'is_updated': msg.is_updated,
            }
            for msg in messages
        ]

    @database_sync_to_async
    def create_file_upload(self, file_data, file_name):
        try:
            if ';base64,' in file_data:
                _, file_str = file_data.split(';base64,', 1)
            else:
                file_str = file_data
            file_bytes = base64.b64decode(file_str)
            content = ContentFile(file_bytes, name=file_name)

            return FileUpload.objects.create(
                user=self.user,
                file=content,
                original_filename=file_name
            )
        except Exception:
            return None

    @database_sync_to_async
    def message_to_dict(self, message):
        return {
            'id': message.id,
            'user': {
                'id': message.user.id,
                'username': message.user.username,
                'fullname': message.user.get_full_name(),
            },
            'content': message.context,
            'message_type': message.message_type,
            'file': {
                'id': message.file.id,
                'name': message.file.file.name,
                'url': message.file.file.url,
                'size': message.file.file.size,
            } if message.file else None,
            'created_at': message.created_at.isoformat(),
            'is_read': message.is_read,
            'is_updated': message.is_updated,
        }
