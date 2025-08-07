from django.db import models
from accounts.models import CustomUser


class Message(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    text = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

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
    message = models.ForeignKey(Message, on_delete=models.SET_NULL, null=True, blank=True, related_name='attachments')
    file = models.FileField(upload_to='uploads/', null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return f'File uploaded by {self.user}'