from rest_framework import serializers
from accounts.models import CustomUser, Contact

from chat.models import Message


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'fullname', 'email', 'phone_number', 'is_online', 'last_seen']

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['fullname', 'username', 'email', 'phone_number']
        
        
    def update(self, instance, validated_data):
        instance.username = validated_data.get('username', instance.username)
        instance.fullname = validated_data.get('fullname', instance.fullname)
        instance.email = validated_data.get('email', instance.email)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.save()
        return instance



class RegisterSerializer(serializers.Serializer):
    fullname = serializers.CharField()
    username = serializers.CharField()
    email = serializers.EmailField()
    phone_number = serializers.CharField()
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
            username = validated_data['username'],
            email = validated_data['email'],
            phone_number = validated_data['phone_number'],
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
    


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['owner', 'contact_user', 'alias']


class ContactSearchSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='contact_user.username', read_only=True)
    name = serializers.CharField(source='contact_user.fullname', read_only=True)
    email = serializers.CharField(source='contact_user.email', read_only=True)
    phone_number = serializers.CharField(source='contact_user.phone_number', read_only=True)

    class Meta:
        model = Contact
        fields = [
            'id', 'alias', 'owner', 'contact_user',
            'username', 'name', 'email', 'phone_number'
        ]
    
    def get_unread_count(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        return Message.objects.filter(
            sender=obj.contact_user,  
            recipient=request.user,   
            is_read=False
        ).count()


class ContactListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'owner', 'contact_user', 'alias']



class ContactUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['alias']



class ChangePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("New passwords do not match")
        return data