from rest_framework import generics, status, permissions
from rest_framework.response import Response

from channel.permissions import IsOwner
from channel.models import Channel, ChannelMessage
from channel.serializers import (
    ChannelSerializer, ChannelMessageSerializer,
    FollowChannelSerializer, ChannelUpdateSerializer,
    ChannelCreateSerializer
)

from django.db.models import Q

from accounts.models import CustomUser



class ChannelApiView(generics.GenericAPIView):
    serializer_class = ChannelCreateSerializer
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
    
class ChannelListApiView(generics.GenericAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated] 
    
    def get(self, request):
        try:
            user_channels = Channel.objects.filter(
                Q(members=request.user) | Q(owner=request.user)
            ).distinct()
            
            serializer = self.get_serializer(user_channels, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'message': 'Error retrieving channels', 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    

class ChannelDeleteApiView(generics.GenericAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [IsOwner]
    
    
    def delete(self, request, id):
        try:
            channel = Channel.objects.get(id=id)
        except Channel.DoesNotExist:
            return Response({'message': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
        channel.delete()
        return Response({'message': 'Channel deleted'}, status=status.HTTP_200_OK)
    
    
    
class ChannelUpdateApiView(generics.GenericAPIView):
    serializer_class = ChannelUpdateSerializer
    permission_classes = [IsOwner]
    
    
    def put(self, request, id):
        try:
            channel = Channel.objects.get(id=id)
        except Channel.DoesNotExist:
            return Response({'message': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(channel, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    

class ChannelDetailApiView(generics.GenericAPIView):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]  
    
    def get(self, request, id):
        try:
            channel = Channel.objects.get(id=id)
            if not channel.members.filter(id=request.user.id).exists():
                return Response({'message': 'You are not subscribed to this channel'}, status=status.HTTP_403_FORBIDDEN)
        except Channel.DoesNotExist:
            return Response({'message': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(channel)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
    
class FollowChannelApiView(generics.GenericAPIView):
    serializer_class = FollowChannelSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid()
        channel_id = serializer.validated_data['channel_id']
        user_id = serializer.validated_data['user_id']
        
        try:
            channel = Channel.objects.get(id=channel_id)
            user = request.user
        except:
            if Channel.DoesNotExist():
                return Response({'error': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
            elif CustomUser.DoesNotExist():
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        channel.members.add(user)
        
        return Response({'message': f'{user.fullname} followed to {channel.name}!'}, status=status.HTTP_200_OK)
    
    
class UnFollowChannelApiView(generics.GenericAPIView):
    serializer_class = FollowChannelSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid()
        channel_id = serializer.validated_data['channel_id']
        user_id = serializer.validated_data['user_id']
        
        try:
            channel = Channel.objects.get(id=channel_id)
            user = request.user
        except:
            if Channel.DoesNotExist():
                return Response({'error': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
            elif CustomUser.DoesNotExist():
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        channel.members.remove(user)
        
        return Response({'message': f'{user.fullname} unfollowed from {channel.name}!'}, status=status.HTTP_200_OK)