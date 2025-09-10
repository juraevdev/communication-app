from channels.layers import get_channel_layer

from asgiref.sync import async_to_sync

from django.utils.timezone import now


def send_notification(user, title, message):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'notifications_{user.id}',
        {
            'type': 'send_notification',
            'title': title,
            'message': message,
            'timestamp': now().isoformat()
        }
    )