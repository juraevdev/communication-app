from rest_framework import serializers
from chat.models import Message, Notification, FileUpload


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = '__all__'



class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'



class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileUpload
        fields = '__all__'