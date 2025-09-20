from django.db import models

from accounts.models import CustomUser

from chat.models import FileUpload

ROLE_CHOICES = (
    ('owner', 'Owner'),
    ('admin', 'Admin'),
    ('member', 'Member'),
)

class Group(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='created_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} as {self.role}"
    
    @property
    def unread_count(self):
        return GroupMessage.objects.filter(
            group=self.group,
            is_read=False
        ).exclude(sender=self.user).count()


class GroupMessage(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_group_messages')
    content = models.TextField(null=True, blank=True)
    file = models.ForeignKey(FileUpload, on_delete=models.SET_NULL, related_name='group_files', null=True, blank=True)
    message_type = models.CharField(max_length=10, default='text', null=True)
    reply_to = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Message by {self.sender.username} in {self.group.name}"
    
    
    def save(self, *args, **kwargs):
        if self.file:
            self.message_type = 'file'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Message by {self.sender.username} in {self.group.name}"
    
    
    def mark_as_read(self, user):
        if self.sender != user and not self.is_read:
            self.is_read = True
            self.save()
            return True
        return False