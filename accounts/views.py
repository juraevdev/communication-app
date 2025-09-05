from django.shortcuts import get_object_or_404
from django.contrib.auth import update_session_auth_hash

from rest_framework import generics, status, filters, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


from accounts.services import get_or_create_room
from accounts.models import CustomUser, Contact, UserProfile
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
        return Contact.objects.filter(owner=self.request.user)




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