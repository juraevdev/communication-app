from rest_framework import serializers

from channel.models import Channel, ChannelMessage


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = '__all__'
        
        
class ChannelUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ['name', 'description', 'updated_at']
        
    
class ChannelMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChannelMessage
        fields = '__all__'
        
        
        
class FollowChannelSerializer(serializers.Serializer):
    channel_id = serializers.IntegerField()
    user_id = serializers.IntegerField()