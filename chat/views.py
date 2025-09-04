from django.shortcuts import get_object_or_404
from django.utils.timezone import now

from rest_framework import generics, status, permissions 
from rest_framework.views import APIView
from rest_framework.response import Response

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from chat.models import Message, Notification, FileUpload
from chat.serializers import MessageSerializer, NotificationSerializer, FileSerializer
from chat.utils import send_notification


from accounts.services import get_or_create_room
from accounts.models import CustomUser, Contact
    


class MessageListApiView(generics.GenericAPIView):
    serializer_class = MessageSerializer
    queryset = Message.objects.all()

    def get(self, request):
        message = Message.objects.all()
        serializer = self.get_serializer(message, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


class FileUploadApiView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FileSerializer

    def post(self, request, *args, **kwargs):
        message_id = request.data.get('message_id')
        file_obj = request.FILES.get('file')

        if not message_id or not file_obj:
            return Response({'error': 'message_id and file are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            message = Message.objects.get(id=message_id)
        except Message.DoesNotExist:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_file = FileUpload.objects.create(
            user=request.user,
            message=message,
            file=file_obj
        )

        serializer = self.get_serializer(uploaded_file)


        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_chat_{min(request.user.username, message.sender.username)}_{max(request.user.username, message.sender.username)}',
            {
                'type': 'file_message',
                'file_url': serializer.data['file'],
                'message_id': serializer.data['message'],
                'uploaded_at': serializer.data['uploaded_at'],
                'sender': request.user.username
            }
        )

        send_notification(
            user=message.recipient,
            title="Yangi fayl",
            message=f"{request.user.username} sizga fayl yubordi"
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    

class StartChatApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        alias = request.data.get("alias")
        if not alias:
            return Response({"error": "alias is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            contact = Contact.objects.get(owner=request.user, alias=alias)
            other_user = contact.contact_user
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

        if other_user == request.user:
            return Response({"error": "You cannot chat with yourself"}, status=status.HTTP_400_BAD_REQUEST)

        room = get_or_create_room(request.user, other_user)
        return Response({"room_id": room.id}, status=status.HTTP_200_OK)