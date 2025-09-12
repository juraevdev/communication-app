from rest_framework import generics, status
from rest_framework.response import Response

from groups.models import Group, GroupMember, GroupMessage
from groups.permissions import IsOwner, IsAdmin
from groups.serializers import GroupSerializer, GroupMemberSerialzer, GroupMessageSerializer

from accounts.models import CustomUser


class GroupApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class GroupDeleteApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    permission_classes = [IsOwner]
    
    def delete(self, request, id):
        try:
            group = Group.objects.get(id=id)
            group.delete()
            return Response({'message': 'Group deleted'}, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({'message': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        
class GroupUpdateApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    permission_classes = [IsOwner, IsAdmin]
    
    def put(self, request, id):
        try:
            group = Group.objects.get(id=id)
            serializer = self.get_serializer(group)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({'message': 'Group updated'}, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({'message': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        
class GroupListApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    
    def get(self, request):
        group = Group.objects.all()
        serializer = self.get_serializer(group, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
class GroupDetailApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    
    def get(self, request, id):
        group = Group.objects.get(id=id)
        serializer = self.get_serializer(group)
        return Response(serializer.data, status=status.HTTP_200_OK)
            
            
            
class GroupMemberAddApiView(generics.GenericAPIView):
    serializer_class = GroupMemberSerialzer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.validated_data['group']
        user = serializer.validated_data['user']
        role = serializer.validated_data['role']
        
        if GroupMember.objects.filter(group=group, user=user).exists():
            return Response({'message': 'User already in group'}, status=status.HTTP_400_BAD_REQUEST)
        
        GroupMember.objects.create(
            group=group,
            user=user,
            role=role
        )
        
        return Response({'message': f'{user.username} added to {group.name}'}, status=status.HTTP_200_OK)
    
    

class GroupMemberDeleteApiView(generics.GenericAPIView):
    serializer_class = GroupMemberSerialzer
    
    def delete(self, request, id):
        try:
            member = GroupMember.objects.get(id=id)
            member.delete()
            return Response({'message': 'User removed from group'}, status=status.HTTP_200_OK)
        except GroupMember.DoesNotExist:
            return Response({'User not found'}, status=status.HTTP_404_NOT_FOUND)
        