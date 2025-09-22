from rest_framework.permissions import BasePermission

from channel.models import Channel, ChannelMessage

class IsOwner(BasePermission):
    def has_permission(self, request, view):
        channel = Channel.objects.filter(owner = request.user)
        