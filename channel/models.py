from django.db import models

from accounts.models import CustomUser


class Channel(models.Model):
    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='channel_owner')
    members = models.ManyToManyField(CustomUser, related_name='channel_members', blank=True)
    name = models.CharField(max_length=50)
    description = models.TextField(null=True, blank=True)
    username = models.CharField(max_length=50, unique=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f'{self.owner} - {self.name}'
    
    class Meta:
        db_table = 'channels'
        ordering = ['-created_at'] 


class ChannelMessage(models.Model):
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('file', 'File'),
    ]
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='channel_message_owner')
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name='channel_message', null=True)
    content = models.TextField(null=True, blank=True)
    file = models.ForeignKey('chat.FileUpload', on_delete=models.SET_NULL, related_name='channel_message_files', null=True, blank=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPE_CHOICES, default='text', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_updated = models.BooleanField(default=False, null=True)
    is_read = models.BooleanField(default=False)
    read_by = models.ManyToManyField(CustomUser, related_name='read_channel_messages', blank=True)
    
    def __str__(self):
        return f'{self.user} - {self.content or "File message"}'
    
    def save(self, *args, **kwargs):
        if self.file:
            self.message_type = 'file'
        super().save(*args, **kwargs)
        
    def mark_as_read_by(self, user):
        if self.user != user and user not in self.read_by.all():
            self.read_by.add(user)
            return True
        return False
    
    
    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('file_download', kwargs={'file_id': self.id})
    
    @property
    def file_url(self):
        if self.file:
            from django.conf import settings
            return f"{settings.BASE_URL.rstrip('/')}{self.file.url}"
        return None
    
    
    class Meta:
        db_table = 'channel_messages'
        ordering = ['created_at']