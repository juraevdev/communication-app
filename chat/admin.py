from django.contrib import admin
from chat.models import Message, FileUpload, Notification, Room


admin.site.register(Room)
admin.site.register(Message)
admin.site.register(FileUpload)
admin.site.register(Notification)