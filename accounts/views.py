from django.shortcuts import get_object_or_404
from django.contrib.auth import update_session_auth_hash
from django.db.models import Q

from rest_framework import generics, status, filters, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from chat.models import Message

from accounts.services import get_or_create_room
from accounts.models import CustomUser, Contact, UserProfile, BlockedUser
from accounts.serializers import (
    RegisterSerializer, LoginSerializer,
    UserProfileSerializer, ContactSerializer,
    ContactSearchSerializer, ContactListSerializer,
    UserSerializer, UserUpdateSerializer
)


class RegisterApiView(generics.GenericAPIView):
    serializer_class = RegisterSerializer


    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            result = serializer.save()
            return Response(result, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    


class LoginApiView(generics.GenericAPIView):
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']

            user = CustomUser.objects.filter(email=email).first()

            if user is None:
                return Response({'error': 'User not found!'}, status=status.HTTP_404_NOT_FOUND)
            
            if not user.check_password(password):
                return Response({'error': 'Password is not correct !'}, status=status.HTTP_401_UNAUTHORIZED)
            
            refresh = RefreshToken.for_user(user)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token)
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

    

class ContactApiView(generics.GenericAPIView):
    serializer_class = ContactSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            contact = serializer.save(owner=request.user)
            target_user = get_object_or_404(CustomUser, id=contact.contact_user.id)
            room = get_or_create_room(request.user, target_user)
            return Response({
                "contact": serializer.data,
                "room_id": room.id
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    

class ContactSearchApiView(generics.ListAPIView):
    serializer_class = ContactSearchSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['alias']
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(owner=self.request.user).select_related('contact_user', 'contact_user__profile')




class ContactListApiView(generics.GenericAPIView):
    serializer_class = ContactListSerializer
    
    def get(self, request):
        contact = Contact.objects.all()
        serializer = self.get_serializer(contact, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class ProfileListApiView(generics.GenericAPIView):
    serializer_class = UserProfileSerializer

    def get(self, request):
        profile = UserProfile.objects.all()
        serializer = self.get_serializer(profile, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    
class UserProfileApiView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, created = UserProfile.objects.get_or_create(user=self.request.user)
        return profile
    


class MeApiView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserFilterApiView(generics.ListAPIView):
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username']
    permission_classes = [permissions.IsAuthenticated]
    queryset = CustomUser.objects.all()


class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        password = request.data.get('password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not user.check_password(password):
            return Response(
                {"message": "Current password is incorrect"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {"message": "New passwords do not match"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 6:
            return Response(
                {"message": "Password must be at least 6 characters long"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()
        update_session_auth_hash(request, user) 

        return Response({"message": "Password changed successfully"})
    

class UserUpdateApiView(generics.RetrieveUpdateAPIView):
    serializer_class = UserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user
    

class UserSearchApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search_term = request.query_params.get('search', '')
        contact_user_ids = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)
        blocked_user_ids = BlockedUser.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)

        users = CustomUser.objects.exclude(id=request.user.id)\
                                  .exclude(id__in=contact_user_ids)\
                                  .exclude(id__in=blocked_user_ids)

        if search_term:
            users = users.filter(
                Q(username__icontains=search_term) |
                Q(fullname__icontains=search_term) |
                Q(email__icontains=search_term)
            )

        user_data = []
        for user in users:
            try:
                profile = user.profile
                image_url = profile.image.url if profile.image else None
                phone_number = profile.phone_number
            except UserProfile.DoesNotExist:
                image_url = None
                phone_number = None

            unread_count = Message.objects.filter(
                sender=user,
                recipient=request.user,
                is_read=False
            ).count()

            last_message = Message.objects.filter(
                room__messages__sender__in=[user, request.user],
                room__messages__recipient__in=[user, request.user]
            ).order_by("-timestamp").first()

            user_data.append({
                'id': user.id,
                'username': user.username,
                'full_name': user.fullname,
                'email': user.email,
                'image': image_url,
                'phone_number': phone_number,
                'is_online': user.is_online,
                'last_seen': user.last_seen,
                'unread_count': unread_count,
                'last_message': last_message.text if last_message else "",
                'last_message_timestamp': last_message.timestamp if last_message else None,
            })

        return Response(user_data, status=status.HTTP_200_OK)