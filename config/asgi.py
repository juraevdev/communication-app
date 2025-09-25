import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.asgi import get_asgi_application

from channels.routing import ProtocolTypeRouter, URLRouter

from chat.middleware import JWTAuthMiddleware
from chat.routing import websocket_urlpatterns as chat_ws
from groups.routing import websocket_urlpatterns as group_ws
from channel.routing import websocket_urlpatterns as channel_ws

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JWTAuthMiddleware(
        URLRouter(
            chat_ws + group_ws + channel_ws
        )
    ),
})
