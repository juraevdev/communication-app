from django.contrib import admin

from channel.models import Channel, ChannelMessage

admin.site.register(Channel)
admin.site.register(ChannelMessage)