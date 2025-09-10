from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q

from rest_framework import generics, status, permissions 
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from chat.models import Message, FileUpload
from chat.serializers import MessageSerializer, FileSerializer
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
        contact_user_id = request.data.get("contact_user")
        alias = request.data.get("alias", "")
        
        if not contact_user_id:
            return Response({"error": "contact_user is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            other_user = CustomUser.objects.get(id=contact_user_id)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        if other_user == request.user:
            return Response({"error": "You cannot chat with yourself"}, status=status.HTTP_400_BAD_REQUEST)

        room = get_or_create_room(request.user, other_user)
        return Response({"room_id": room.id}, status=status.HTTP_200_OK)
    

@api_view(['GET'])
def download_file(request, file_id):
    file_upload = get_object_or_404(FileUpload, id=file_id)
    
    if request.user not in [file_upload.user, file_upload.recipient]:
        return Response(
            {"error": "You don't have permission to access this file."},
            status=status.HTTP_403_FORBIDDEN
        )
    
    original_filename = file_upload.original_filename
    
    response = FileResponse(file_upload.file.open(), as_attachment=True)
    response['Content-Disposition'] = f'attachment; filename="{original_filename}"'
    
    return response


@api_view(['GET'])
def get_user_files(request):
    try:
        files = FileUpload.objects.filter(
            Q(user=request.user) | Q(recipient=request.user)
        ).select_related('user').order_by('-uploaded_at')
        
        data = [{
            'id': file.id,
            'name': file.original_filename if hasattr(file, 'original_filename') and file.original_filename else file.file.name.split('/')[-1],
            'type': get_file_type(file.file.name),
            'size': format_file_size(file.file.size),
            'uploadedBy': file.user.fullname if file.user.fullname else file.user.email,
            'uploadDate': file.uploaded_at.strftime("%Y-%m-%d %H:%M"),
            'downloadCount': file.download_count if hasattr(file, 'download_count') else 0,
            'isOwner': file.user == request.user,
            'roomId': file.room.id if file.room else None
        } for file in files]
        
        return Response(data)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

def get_file_type(filename):
    if not filename:
        return 'file'
    
    extension = filename.split('.')[-1].lower() if '.' in filename else ''
    
    if extension in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        return 'image'
    elif extension in ['mp4', 'avi', 'mov', 'wmv']:
        return 'video'
    elif extension in ['mp3', 'wav', 'ogg', 'flac']:
        return 'audio'
    elif extension == 'pdf':
        return 'pdf'
    elif extension in ['doc', 'docx']:
        return 'document'
    elif extension in ['xls', 'xlsx']:
        return 'spreadsheet'
    elif extension in ['zip', 'rar', '7z']:
        return 'archive'
    elif extension in ['txt']:
        return 'text'
    else:
        return 'file'

def format_file_size(size_bytes):
    if size_bytes == 0:
        return "0B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names)-1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f}{size_names[i]}"