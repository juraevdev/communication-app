from rest_framework import generics, status, filters, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken


from accounts.models import CustomUser, Contact, UserProfile
from accounts.serializers import (
    RegisterSerializer, LoginSerializer,
    UserProfileSerializer, ContactSerializer,
    ContactSearchSerializer, ContactListSerializer,
    UserSerializer
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
    

class UserProfileApiView(generics.GenericAPIView):
    serializer_class = UserProfileSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid(raise_exception=True):
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

class ProfileListApiView(generics.GenericAPIView):
    serializer_class = UserProfileSerializer

    def get(self, request):
        profile = UserProfile.objects.all()
        serializer = self.get_serializer(profile, many=True)
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
        return Contact.objects.filter(owner=self.request.user)




class ContactListApiView(generics.GenericAPIView):
    serializer_class = ContactListSerializer
    
    def get(self, request):
        contact = Contact.objects.all()
        serializer = self.get_serializer(contact, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    

class MeApiView(generics.GenericAPIView):
    serializer_class = UserSerializer

    def get(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class UserFilterApiView(generics.ListAPIView):
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username']
    permission_classes = [permissions.IsAuthenticated]
    queryset = CustomUser.objects.all()
