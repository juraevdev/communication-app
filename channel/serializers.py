from rest_framework import serializers

from channel.models import Channel, ChannelMessage


class ChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = '__all__'
        

class ChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ['name', 'username', 'description', 'owner']

        
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



class ChannelListSerializer(serializers.ModelSerializer):
    isSubscribed = serializers.SerializerMethodField()
    isOwner = serializers.SerializerMethodField()
    type = serializers.CharField(default='channel', read_only=True)
    
    class Meta:
        model = Channel
        fields = ['id', 'name', 'description', 'username', 'owner', 'created_at', 'type', 'isSubscribed', 'isOwner']
    
    def get_isSubscribed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user in obj.members.all()
        return False
    
    def get_isOwner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner == request.user
        return False