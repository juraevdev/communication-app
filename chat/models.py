from django.db import models
from django.utils import timezone

from accounts.models import CustomUser



class Room(models.Model):
    user1 = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='chat_room_sender', null=True)
    user2 = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='chat_room_receiver', null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user1', 'user2'], name='unique_room_between_users')
        ]

    def __str__(self):
        return f'{self.user1} - {self.user2}'



class Message(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='messages', null=True)
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    text = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    is_updated = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['sender', 'recipient']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['is_read']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f'Message from {self.sender} to {self.recipient} at {self.timestamp}'



class Notification(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        if self.message:
            return f'Notification for {self.user} about message {self.message.id}'
        return f'Notification for {self.user}: {self.message}'
    


class FileUpload(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='uploaded_files')
    room = models.ForeignKey('chat.Room', on_delete=models.CASCADE, related_name='files', null=True, blank=True)
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_files', null=True, blank=True)
    group = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='group_uploaded_files', null=True, blank=True)
    channel = models.ForeignKey('channel.Channel', on_delete=models.CASCADE, related_name='channel_uploaded_files', null=True, blank=True)
    file = models.FileField(upload_to='chat_files/%Y/%m/%d/', null=True)
    original_filename = models.CharField(max_length=255, null=True)  
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f'File uploaded by {self.user.username if self.user else "Unknown"}'
    
    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('file_download', kwargs={'file_id': self.id})
    
    @property
    def file_url(self):
        if self.file:
            from django.conf import settings
            return f"{settings.BASE_URL}{self.file.url}"
        return None
    
    class Meta:
        db_table = 'file_uploads'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['user', 'uploaded_at']),
            models.Index(fields=['room', 'uploaded_at']),
            models.Index(fields=['group', 'uploaded_at']),
            models.Index(fields=['channel', 'uploaded_at']),
        ]