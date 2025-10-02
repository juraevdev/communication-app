from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response

from channel.permissions import IsOwner
from channel.models import Channel, ChannelMessage
from channel.serializers import (
    ChannelSerializer, ChannelMessageSerializer,
    FollowChannelSerializer, ChannelUpdateSerializer,
    ChannelCreateSerializer, ChannelListSerializer
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
            
            channels_data = []
            for channel in user_channels:
                last_message = ChannelMessage.objects.filter(
                    channel=channel
                ).order_by('-created_at').first()
                
                serializer = self.get_serializer(channel)
                channel_data = serializer.data
                
                if last_message:
                    channel_data['last_message_time'] = last_message.created_at.isoformat()
                else:
                    channel_data['last_message_time'] = channel.created_at.isoformat()
                    
                channels_data.append(channel_data)
            
            return Response(channels_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'message': 'Error retrieving channels', 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
# class ChannelListApiView(generics.GenericAPIView):
#     serializer_class = ChannelSerializer
#     permission_classes = [permissions.IsAuthenticated] 
    
#     def get(self, request):
#         try:
#             # Barcha kanallarni olish (faqat foydalanuvchi kanallarini emas)
#             all_channels = Channel.objects.all()
            
#             # Serializer da context yuborish
#             serializer = self.get_serializer(
#                 all_channels, 
#                 many=True, 
#                 context={'request': request}  # Bu muhim!
#             )
            
#             return Response(serializer.data, status=status.HTTP_200_OK)
#         except Exception as e:
#             return Response({'message': 'Error retrieving channels', 'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
    

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
    


class ChannelFilterApiView(generics.ListAPIView):
    serializer_class = ChannelSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username']
    permission_classes = [permissions.IsAuthenticated]
    queryset = Channel.objects.all()
    
    
    
class FollowChannelApiView(generics.GenericAPIView):
    serializer_class = FollowChannelSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        channel_id = serializer.validated_data['channel_id']
        user_id = serializer.validated_data['user_id']
        
        try:
            channel = Channel.objects.get(id=channel_id)
            user = request.user
            
            # Security check: ensure user can only follow for themselves
            if user.id != user_id:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
                
        except Channel.DoesNotExist:
            return Response({'error': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if user in channel.members.all():
            return Response({
                'message': 'Already following this channel',
                'is_subscribed': True
            }, status=status.HTTP_200_OK)
            
        channel.members.add(user)
        
        return Response({
            'message': f'{user.fullname} followed {channel.name}!',
            'is_subscribed': True
        }, status=status.HTTP_200_OK)


class UnFollowChannelApiView(generics.GenericAPIView):
    serializer_class = FollowChannelSerializer
    
    def post(self, request, *args, **kwargs):  # Using POST since URL has no parameters
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        channel_id = serializer.validated_data['channel_id']
        user_id = serializer.validated_data['user_id']
        
        try:
            channel = Channel.objects.get(id=channel_id)
            user = request.user
            
            # Security check: ensure user can only unfollow for themselves
            if user.id != user_id:
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
                
        except Channel.DoesNotExist:
            return Response({'error': 'Channel not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if user not in channel.members.all():
            return Response({
                'message': 'Not following this channel',
                'is_subscribed': False
            }, status=status.HTTP_200_OK)
            
        channel.members.remove(user)
        
        return Response({
            'message': f'{user.fullname} unfollowed from {channel.name}!',
            'is_subscribed': False
        }, status=status.HTTP_200_OK)