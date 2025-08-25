import json
import base64

from django.contrib.auth.models import AnonymousUser
from django.core.files.base import ContentFile

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from chat.models import Room, Message, FileUpload


class P2PChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'p2p_chat_{self.room_id}'

        if self.user == AnonymousUser():
            await self.close()
            return

        self.room = await self.get_room()
        if not self.room or not await self.user_in_room():
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        last_messages = await self.last_messages()
        await self.send_json({
            "type": "message_history",
            "messages": last_messages
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive_json(self, content):
        action = content.get('action')

        if not action:
            await self.send_json({"error": 'action is required'})
            return
        
        if action == "send":
            message_text = content.get('message')
            if not message_text:
                await self.send_json({"error": "Message is required"})
                return
            
            saved_message = await self.message_save(message_text)
            message_data = await self.get_message_data(saved_message.id)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    **message_data
                }
            )

        elif action == 'read':
            message_id = content.get('message_id')
            if not message_id:
                await self.send_json({'error': "message_id is required"})    
                return
            
            success = await self.mark_message_as_read(message_id)
            if success:
                await self.send_json({'success': 'Message marked as read'})
            else:
                await self.send_json({'error': 'Failed to mark message as read'})

        elif action == "delete":
            message_id = content.get("message_id")
            if not message_id:
                await self.send_json({"error": "message_id required"})
                return
            
            success = await self.delete_message(message_id)
            if success:
                await self.send_json({'success': 'Message deleted'})
            else:
                await self.send_json({"error": "You cannot delete this message"})

        elif action == "edit":
            message_id = content.get('message_id')
            new_message = content.get('new_message')
            
            if not message_id or not new_message:
                await self.send_json({'error': 'message_id and new_message are required'})
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
                await self.send_json({'error': 'You cannot edit this message'})

        elif action == "upload_file":
            file_data = content.get('file_data')
            file_name = content.get('file_name')
            file_type = content.get('file_type')
            
            if not file_data or not file_name:
                await self.send_json({"error": "file_data and file_name are required"})
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
                await self.send_json({"error": "Failed to upload file"})

        elif action == "read_file":
            file_id = content.get('file_id')
            if not file_id:
                await self.send_json({'error': "file_id is required"})    
                return
        
            success = await self.mark_file_as_read(file_id)
            if success:
                await self.send_json({'success': 'File marked as read'})
            else:
                await self.send_json({'error': 'Failed to mark file as read'})

        elif action == "delete_file":
            file_id = content.get('file_id')
            if not file_id:
                await self.send_json({"error": "file_id required"})
                return
        
            success = await self.delete_file(file_id)
            if success:
                await self.send_json({'success': 'File deleted'})
            else:
                await self.send_json({"error": "You cannot delete this file"})

        else:
            await self.send_json({"error": "Invalid action. Choose from: send, read, delete, edit, upload_file, read_file, delete_file"})
        

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

    @database_sync_to_async
    def get_message_data(self, message_id):
        try:
            message = Message.objects.select_related('sender').get(id=message_id)
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
        except Message.DoesNotExist:
            return None

    @database_sync_to_async
    def get_room(self):
        try:
            return Room.objects.get(id=self.room_id)
        except Room.DoesNotExist:
            return None

    @database_sync_to_async
    def user_in_room(self):
        return self.user in [self.room.user1, self.room.user2]

    @database_sync_to_async
    def message_save(self, message_text):
        recipient = self.room.user2 if self.user == self.room.user1 else self.room.user1
        
        return Message.objects.create(
            room=self.room,
            sender=self.user,
            recipient=recipient,
            text=message_text
        )

    @database_sync_to_async
    def last_messages(self, limit=50):
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

    @database_sync_to_async
    def mark_message_as_read(self, message_id):
        try:
            message = Message.objects.get(
                id=message_id, 
                room=self.room,
                recipient=self.user
            )
            message.is_read = True
            message.save()
            return True
        except Message.DoesNotExist:
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

    @database_sync_to_async
    def edit_message(self, message_id, new_message):
        try:
            message = Message.objects.get(
                id=message_id, 
                room=self.room, 
                sender=self.user
            )
            message.text = new_message
            message.is_updated = True
            message.save()
            return message
        except Message.DoesNotExist:
            return False
        

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
    def save_file(self, file_data, file_name, file_type=None):
        """Base64 faylni saqlash"""
        try:
            format, file_str = file_data.split(';base64,')
            file_bytes = base64.b64decode(file_str)
            
            file_content = ContentFile(file_bytes, name=file_name)
            
            file_upload = FileUpload.objects.create(
                user=self.user,
                file=file_content
            )
            
            return file_upload
        except Exception as e:
            print(f"File upload error: {e}")
            return None


    @database_sync_to_async
    def get_file_data(self, file_upload_id):
        """Fayl ma'lumotlarini olish"""
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


    @database_sync_to_async
    def mark_file_as_read(self, file_id):
        try:
            file_upload = FileUpload.objects.get(id=file_id)
        
            if file_upload.message:
                if file_upload.message.recipient == self.user:
                    file_upload.is_read = True
                    file_upload.save()
                    return True
                return False
        
        except FileUpload.DoesNotExist:
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



import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f'notifications_{self.user.id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def notify(self, event):
        """
        Signal orqali keladigan eventni clientga jo‘natamiz
        """
        await self.send_json({
            'type': 'notification',
            'message': event['message'],
            'data': event['data']
        })
