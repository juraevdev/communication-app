import os
import django
from django.core.asgi import get_asgi_application

from channels.routing import ProtocolTypeRouter, URLRouter

from chat.middleware import JWTAuthMiddleware
from chat.routing import websocket_urlpatterns

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()
django.setup()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})