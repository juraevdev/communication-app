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
        

class GroupMessageSerializer(serializers.Serializer):
    class Meta:
        model = GroupMessage
        fields = '__all__'