from django.shortcuts import get_object_or_404
from django.contrib.auth import update_session_auth_hash
from django.db.models import Q

from rest_framework import generics, status, filters, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from chat.models import Message

from accounts.services import get_or_create_room
from accounts.models import CustomUser, Contact
from accounts.serializers import (
    RegisterSerializer, LoginSerializer,
    ContactSerializer, ContactSearchSerializer, 
    ContactListSerializer, ContactUpdateSerializer,
    UserSerializer, UserUpdateSerializer, 
    ChangePasswordSerializer
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
    

class UserSearchApiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search_term = request.query_params.get('search', '')
        contact_user_ids = Contact.objects.filter(owner=request.user).values_list('contact_user_id', flat=True)

        users = CustomUser.objects.exclude(id=request.user.id)\
                                  .exclude(id__in=contact_user_ids)

        if search_term:
            users = users.filter(
                Q(username__icontains=search_term) |
                Q(fullname__icontains=search_term) |
                Q(phone_number__icontains=search_term) |
                Q(email__icontains=search_term)
            )

        user_data = []
        for user in users:
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
                'phone_number': user.phone_number,
                'is_online': user.is_online,
                'last_seen': user.last_seen,
                'unread_count': unread_count,
                'last_message': last_message.text if last_message else "",
                'last_message_timestamp': last_message.timestamp if last_message else None,
            })

        return Response(user_data, status=status.HTTP_200_OK)


class UserFilterApiView(generics.ListAPIView):
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['phone_number']
    permission_classes = [permissions.IsAuthenticated]
    queryset = CustomUser.objects.all()


class UserUpdateApiView(generics.GenericAPIView):
    serializer_class = UserUpdateSerializer

    def put(self, request):
        try:
            user = request.user
            serializer = self.get_serializer(user, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except CustomUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)        


class GetUserApiView(generics.GenericAPIView):
    serializer_class = UserSerializer

    def get(self, request, id):
        user = CustomUser.objects.get(id=id)
        serializer = self.get_serializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)    



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
        return Contact.objects.filter(owner=self.request.user).select_related('contact_user')



class ContactListApiView(generics.GenericAPIView):
    serializer_class = ContactListSerializer
    
    def get(self, request):
        contact = Contact.objects.all()
        serializer = self.get_serializer(contact, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class ContactDeleteApiView(generics.GenericAPIView):
    serializer_class = ContactSerializer

    def delete(self, request, id):
        try:
            contact = Contact.objects.get(id=id)
            contact.delete()
            return Response({'message': 'Contact deleted'}, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({'error': 'Contact not found'}, status=status.HTTP_400_BAD_REQUEST)
        


class ContactUpdateApiView(generics.GenericAPIView):
    serializer_class = ContactUpdateSerializer

    def put(self, request, id):
        try:
            contact = Contact.objects.get(id=id)
            serializer = self.get_serializer(contact, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Contact.DoesNotExist:
            return Response({'error': 'Contact not found'}, status=status.HTTP_404_NOT_FOUND)
    
    

class MeApiView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user



class ChangePasswordView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        data = serializer.validated_data

        if not user.check_password(data['password']):
            return Response(
                {"message": "Current password is incorrect"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.check_password(data['new_password']):
            return Response(
                {"message": "New password must be different from current password"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(data['new_password'])
        user.save()
        update_session_auth_hash(request, user) 

        return Response({"message": "Password changed successfully"})