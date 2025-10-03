from rest_framework import serializers

from channel.models import Channel, ChannelMessage


class ChannelSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.fullname', read_only=True)
    member_count = serializers.SerializerMethodField()
    is_subscribed = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    isOwner = serializers.SerializerMethodField()   
    
    class Meta:
        model = Channel
        fields = [
            'id', 'name', 'description', 'username', 
            'owner', 'owner_name', 'member_count', 
            'is_subscribed', 'created_at', 'updated_at',
            'last_message', 'isOwner'   
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_is_subscribed(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            is_owner = obj.owner_id == request.user.id
            is_member = obj.members.filter(id=request.user.id).exists()
            return is_owner or is_member
        return False
    
    def get_isOwner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner_id == request.user.id
        return False
    
    def get_last_message(self, obj):
        from channel.models import ChannelMessage
        last_msg = ChannelMessage.objects.filter(channel=obj).order_by('-created_at').first()
        if last_msg:
            if last_msg.message_type == 'file':
                return f"📎 {last_msg.file.original_filename if last_msg.file else 'Fayl'}"
            return last_msg.content or ""
        return ""
        

class ChannelCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ['name', 'username', 'description', 'owner']

        
class ChannelUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Channel
        fields = ['name', 'description', 'updated_at']
        
    
class ChannelMessageSerializer(serializers.ModelSerializer):
    is_own = serializers.SerializerMethodField()
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    user_info = serializers.SerializerMethodField()
    
    class Meta:
        model = ChannelMessage
        fields = [
            'id', 'content', 'user', 'user_info', 'channel', 'file',
            'message_type', 'created_at', 'updated_at', 'is_updated',
            'is_read', 'read_by', 'is_own', 'can_edit', 'can_delete'
        ]
    
    def get_is_own(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user.id == request.user.id
        return False
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user.id == request.user.id or obj.channel.owner.id == request.user.id
        return False
    
    def get_can_delete(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user.id == request.user.id or obj.channel.owner.id == request.user.id
        return False
    
    def get_user_info(self, obj):
        return {
            'id': obj.user.id,
            'fullname': obj.user.fullname,
            'email': obj.user.email
        }
        
        
        
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