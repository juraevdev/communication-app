from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response

from chat.models import Message, Notification, FileUpload
from chat.serializers import MessageSerializer, NotificationSerializer, FileSerializer


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