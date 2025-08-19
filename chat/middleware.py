from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

from rest_framework_simplejwt.tokens import AccessToken

from django.contrib.auth.models import AnonymousUser
from accounts.models import CustomUser

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        headers = dict(scope['headers'])
        token = None

        if b'authorization' in headers:
            auth_header = headers[b'authorization'].decode()
            if auth_header.startswith('Bearer'):
                token = auth_header.split(' ')[1]

        
        if token:
            try:
                validated_token = AccessToken(token)
                user_id = validated_token['user_id']
                user = await self.get_user(user_id)
                scope['user'] = user
            except Exception as e:
                print(e)
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_user(self, user_id):
        return CustomUser.objects.get(id=user_id)