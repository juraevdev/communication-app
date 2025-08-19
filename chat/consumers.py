import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from asgiref.sync import sync_to_async

from chat.models import Message
from accounts.models import CustomUser

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.other_fullname = self.scope['url_route']['kwargs']['fullname']
        self.user = self.scope['user']

        # Foydalanuvchi anonim yoki fullname atributiga ega emas bo'lsa ulanishni yopamiz
        if self.user.is_anonymous or not hasattr(self.user, 'fullname') or not self.user.fullname:
            await self.close()
            return

        self.room_name = f'chat_{min(self.user.fullname, self.other_fullname)}_{max(self.user.fullname, self.other_fullname)}'
        self.room_group_name = f'chat_{self.room_name}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # last_messages = await self.last_messages()

        # last_messages = list(reversed(last_messages))
        # readed_messages = []
        # unreaded_messages = []

        # for msg in last_messages:
        #     message = {
        #         "id": str(msg.id),
        #         "message": msg.message,
        #         "sender": {
        #             "id": str(msg.sender.id),
        #             "email": msg.sender.email,
        #             "full_name": msg.sender.full_name
        #         },
        #         "is_updated": msg.is_updated,
        #         "is_read": msg.is_read,
        #         "created_at": str(msg.created_at),
        #     }
        #     if msg.is_read:
        #         readed_messages.append(message)
        #     else:
        #         unreaded_messages.append(message)
        # await self.channel_layer.group_send(
        #     self.room_group_name,
        #     {
        #         "type": "group_message_history",
        #         "readed_messages": readed_messages,
        #         "unreaded_messages": unreaded_messages
        #     }
        # )

    async def disconnect(self, close_code):
        # Agar room_group_name mavjud bo'lsa guruhdan chiqaramiz
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data['message']

        recipient = await sync_to_async(CustomUser.objects.get)(fullname=self.other_fullname)

        msg_obj = await sync_to_async(Message.objects.create)(
            sender=self.user,
            recipient=recipient,
            text=message
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender': self.user.fullname,
                'timestamp': str(msg_obj.timestamp)
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp']
        }))

    
    async def file_notification(self, file_data):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'file_message',
                'file_url': file_data['file'],
                'message_id': file_data['message_id'],
                'uploaded_at': file_data['uploaded_at'],
                'sender': self.user.fullname
            }
        )

    
    async def file_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'file',
            'file_url': event['file_url'],
            'message_id': event['message_id'],
            'uploaded_at': event['uploaded_at'],
            'sender': event['sender']
        }))


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if self.user.is_anonymous:
            await self.close()
        else:
            self.group_name = f'notification_{self.user.id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)


    async def receive(self, text_data=None, bytes_data=None):
        pass


    async def send_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'title': event['title'],
            'message': event['message'],
            'timestamp': event['timestampt'],
        }))