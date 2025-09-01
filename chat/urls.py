from django.urls import path

from chat.views import MessageListApiView, FileUploadApiView, StartChatApiView


urlpatterns = [
    path('message/all/', MessageListApiView.as_view(), name='message-list'),
    path('file-upload/', FileUploadApiView.as_view(), name='file-upload'),
    path("start/", StartChatApiView.as_view(), name="start-chat"),
]