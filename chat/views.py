from django.shortcuts import get_object_or_404
from django.utils.timezone import now

from rest_framework import generics, status, permissions
from rest_framework.response import Response

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from chat.models import Message, Notification, FileUpload
from chat.serializers import MessageSerializer, NotificationSerializer, FileSerializer
from chat.utils import send_notification


# class MessageApiView(generics.GenericAPIView):
#     serializer_class = MessageSerializer

#     def post(self, request, *args, **kwargs):
#         serializer = self.get_serializer(data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response({'message': 'Message created'}, status=status.HTTP_201_CREATED)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    


class MessageListApiView(generics.GenericAPIView):
    serializer_class = MessageSerializer
    queryset = Message.objects.all()

    def get(self, request):
        message = Message.objects.all()
        serializer = self.get_serializer(message, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


# class MessageDeleteApiView(generics.GenericAPIView):
#     serializer_class = MessageSerializer
#     queryset = Message.objects.all()

#     def delete(self, request, id):
#         try: 
#             message = Message.objects.get(id=id)
#         except Message.DoesNotExist:
#             return Response({'message': 'Message not exist'}, status=status.HTTP_404_NOT_FOUND)
#         message.delete()
#         return Response({'message': 'Message deleted'}, status=status.HTTP_200_OK)
    


# class MessageUpdateApiView(generics.GenericAPIView):
#     serializer_class = MessageSerializer
#     queryset = Message.objects.all()

#     def put(self, request, id):
#         message = get_object_or_404(Message, id=id)
#         serializer = self.get_serializer(message, data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data, status=status.HTTP_200_OK)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
    