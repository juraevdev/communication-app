from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import GroupMember
from .serializers import GroupMemberSerialzer


@receiver(post_save, sender=GroupMember)
def member_joined_signal(sender, instance, created, **kwargs):
    if created:
        channel_layer = get_channel_layer()
        group_room_name = f'group_{instance.group.id}'
        
        async_to_sync(channel_layer.group_send)(
            group_room_name,
            {
                'type': 'member_joined',
                'user': {
                    'id': instance.user.id,
                    'fullname': instance.user.fullname,
                    'role': instance.role
                }
            }
        )


@receiver(post_delete, sender=GroupMember)
def member_left_signal(sender, instance, **kwargs):
    channel_layer = get_channel_layer()
    group_room_name = f'group_{instance.group.id}'
    
    async_to_sync(channel_layer.group_send)(
        group_room_name,
        {
            'type': 'member_left',
            'user_id': instance.user.id,
            'user_name': instance.user.fullname
        }
    )