from django.db.models.signals import post_save
from django.dispatch import receiver

from asgiref.sync import async_to_sync

from channels.layers import get_channel_layer

from chat.models import Message, Notification
from chat.serializers import NotificationSerializer

channel_layer = get_channel_layer()


@receiver(post_save, sender=Message)
def create_notification(sender, instance, created, **kwargs):
    if created:
        notification = Notification.objects.create(
            user=instance.recipient,
            message=instance
        )

        serializer = NotificationSerializer(notification)


        async_to_sync(channel_layer.group_send)(
            f'notifications_{instance.recipient.id}',
            {
                'type': 'notify',
                'message': 'New message notification',
                'data': serializer.data
            }
        )