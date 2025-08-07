from django.urls import path

from chat.views import MessageListApiView


urlpatterns = [
    # path('message/', MessageApiView.as_view(), name='message-create'),
    path('message/all/', MessageListApiView.as_view(), name='message-list'),
    # path('message/delete/<int:id>/', MessageDeleteApiView.as_view(), name='message-delete'),
    # path('message/edit/<int:id>/', MessageUpdateApiView.as_view(), name='message-edit'),
]