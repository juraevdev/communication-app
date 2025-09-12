from rest_framework import serializers

from groups.models import Group, GroupMember, GroupMessage


class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'
        
        
        
class GroupMemberSerialzer(serializers.ModelSerializer):
    class Meta:
        model = GroupMember
        fields = ['group', 'user', 'role']        
        
        
        
class GroupMessageSerializer(serializers.ModelSerializer):
    sender_fullname = serializers.CharField(source="sender.fullname", read_only=True)
    sender_username = serializers.CharField(source="sender.username", read_only=True)

    class Meta:
        model = GroupMessage
        fields = ["id", "group", "sender", "sender_fullname", "sender_username",
                  "content", "file", "reply_to", "created_at"]

        

class GroupMembersSerializer(serializers.ModelSerializer):
    user_fullname = serializers.CharField(source="user.fullname", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "user", "user_fullname", "user_username", "role", "joined_at"]
        