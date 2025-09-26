from django.db import models

from accounts.models import CustomUser

from chat.models import FileUpload


class Channel(models.Model):
    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='channel_owner')
    members = models.ManyToManyField(CustomUser, related_name='channel_members')
    name = models.CharField(max_length=50)
    description = models.TextField(null=True, blank=True)
    username = models.CharField(max_length=50, unique=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f'{self.owner} - {self.name}'
    
    
    
class ChannelMessage(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='channel_message_owner')
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name='channel_message', null=True)
    context = models.TextField(null=True, blank=True)
    file = models.ForeignKey(FileUpload, on_delete=models.CASCADE, related_name='channel_files', null=True, blank=True)
    message_type = models.CharField(max_length=10, default='text', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_updated = models.BooleanField(default=False, null=True)
    is_read = models.BooleanField(default=False)
    
    def __str__(self):
        return f'{self.user} - {self.context or self.file}'