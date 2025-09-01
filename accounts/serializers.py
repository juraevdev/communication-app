from rest_framework import serializers
from accounts.models import CustomUser, UserProfile, Contact



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = '__all__'


class RegisterSerializer(serializers.Serializer):
    fullname = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField()
    confirm_password = serializers.CharField()

    def validate(self, data):
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        if password != confirm_password:
            raise serializers.ValidationError('Password didn\'t match')
        return data
    
    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            fullname = validated_data['fullname'],
            email = validated_data['email'],
            password = validated_data['password'],
        )
        return {
            'message': 'Registered'
        }
    

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


    def validate(self, data):
        email = data.get('email')
        password = data.get('password')
        user = CustomUser.objects.filter(email=email, password=password)
        if user is None:
            raise serializers.ValidationError("Invalid email or password")
        return data 
    

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'


class ContactSerializer(serializers.Serializer):
    class Meta:
        model = Contact
        fields = ['owner', 'contact_user', 'alias']


class ContactSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['username']


class ContactListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'owner', 'contact_user', 'alias']