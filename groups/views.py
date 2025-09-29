from rest_framework import generics, status, permissions
from rest_framework.response import Response

from groups.models import Group, GroupMember, GroupMessage
from groups.permissions import IsGroupOwner, IsGroupAdmin, IsGroupOwnerOrAdmin
from groups.serializers import GroupSerializer, GroupMemberSerialzer, GroupMessageSerializer, GroupMembersSerializer, GroupUpdateSerializer


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
    permission_classes = [IsGroupOwner]  
    
    def delete(self, request, id):
        try:
            group = Group.objects.get(id=id)
            self.check_object_permissions(request, group) 
            group.delete()
            return Response({'message': 'Group deleted'}, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({'message': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)



class GroupUpdateApiView(generics.GenericAPIView):
    serializer_class = GroupUpdateSerializer
    permission_classes = [IsGroupOwnerOrAdmin] 
    
    def put(self, request, id):
        try:
            group = Group.objects.get(id=id)
            self.check_object_permissions(request, group)  
            serializer = self.get_serializer(group, data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response({'message': 'Group updated'}, status=status.HTTP_200_OK)
        except Group.DoesNotExist:
            return Response({'message': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
        
        

class GroupListApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    
    def get(self, request):
        user_groups = Group.objects.filter(members__user=request.user)
        
        serializer = self.get_serializer(user_groups, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    

class GroupDetailApiView(generics.GenericAPIView):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, id):
        group = Group.objects.get(id=id)
        serializer = self.get_serializer(group)
        return Response(serializer.data, status=status.HTTP_200_OK)
            
            
            
class GroupMemberAddApiView(generics.GenericAPIView):
    serializer_class = GroupMemberSerialzer
    permission_classes = [IsGroupOwnerOrAdmin]
    
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
    permission_classes = [IsGroupOwnerOrAdmin]
    
    def delete(self, request, group_id, user_id):
        try:
            member = GroupMember.objects.get(group_id=group_id, user_id=user_id)
            
            if member.user == request.user:
                return Response(
                    {'message': 'You cannot remove yourself'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if member.role == 'owner':
                return Response(
                    {'message': 'Cannot remove group owner'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            member.delete()
            return Response({'message': 'Member removed'}, status=status.HTTP_200_OK)
            
        except GroupMember.DoesNotExist:
            return Response({'message': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)
        

        
class GroupMembersApiView(generics.GenericAPIView):
    serializer_class = GroupMembersSerializer

    def get(self, request, group_id):
        members = GroupMember.objects.filter(group_id=group_id)
        serializer = self.get_serializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

        

class GroupMessageListApiView(generics.GenericAPIView):
    serializer_class = GroupMessageSerializer
    
    def get(self, request, group_id):
        messages = GroupMessage.objects.filter(group_id=group_id)
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
    
class GroupMemberDetailApiView(generics.GenericAPIView):
    serializer_class = GroupMembersSerializer
    
    def get(self, request, id):
        member = GroupMember.objects.get(id=id)
        serializer = self.get_serializer(member)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    

class UpdateGroupMemberRoleApiView(generics.GenericAPIView):
    permission_classes = [IsGroupOwner] 
    serializer_class = GroupMembersSerializer
    
    def put(self, request, group_id, user_id):
        try:
            member = GroupMember.objects.get(group_id=group_id, user_id=user_id)
            group = member.group
            
            self.check_object_permissions(request, group)
            
            new_role = request.data.get('role')
            
            if new_role not in ['owner', 'admin', 'member']:
                return Response(
                    {'message': 'Invalid role'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if member.role == 'owner' and request.user != member.user:
                return Response(
                    {'message': 'Cannot change owner role'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if member.user == request.user and new_role == 'member':
                return Response(
                    {'message': 'You cannot demote yourself'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            member.role = new_role
            member.save()
            
            serializer = self.get_serializer(member)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except GroupMember.DoesNotExist:
            return Response(
                {'message': 'Member not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )