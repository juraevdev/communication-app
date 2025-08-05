from django.contrib import admin
from chat.models import Message, FileUpload, Notification


admin.site.register(Message)
admin.site.register(FileUpload)
admin.site.register(Notification)