from django.urls import path

from chat.views import MessageListApiView, FileUploadApiView, StartChatApiView, download_file, get_user_files


urlpatterns = [
    path('message/all/', MessageListApiView.as_view(), name='message-list'),
    path('file-upload/', FileUploadApiView.as_view(), name='file-upload'),
    path("start/", StartChatApiView.as_view(), name="start-chat"),
    path('files/<int:file_id>/download/', download_file, name='file_download'),
    path('user-files/', get_user_files, name='user-files'),   
]