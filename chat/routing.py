from django.urls import re_path
from chat.consumers import P2PChatConsumer, NotificationConsumer, StatusConsumer

websocket_urlpatterns = [
    re_path(r"ws/status/$", StatusConsumer.as_asgi()),
    re_path(r'ws/chat/room/(?P<room_id>\w+)/$', P2PChatConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
]
