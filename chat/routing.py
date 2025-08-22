from django.urls import re_path
from chat.consumers import P2PChatConsumer

websocket_urlpatterns = [
    re_path(r'ws/chat/room/(?P<room_id>\w+)/$', P2PChatConsumer.as_asgi()),
]
