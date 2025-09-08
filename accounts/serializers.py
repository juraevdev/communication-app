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


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['owner', 'contact_user', 'alias']


class ContactSearchSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = ['id', 'alias', 'image', 'owner', 'contact_user', 'is_online']

    def get_image(self, obj):
        profile = getattr(obj.contact_user, 'profile')
        if profile and profile.image:
            return self.context['request'].build_absolute_uri(profile.image.url)
        return None

    def get_is_online(self, obj):
        return getattr(obj.contact_user, 'is_online', False)




class ContactListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'owner', 'contact_user', 'alias']


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["phone_number", "image"]


class UserUpdateSerializer(serializers.ModelSerializer):
    # Nested profile serializer
    profile = UserProfileUpdateSerializer(required=False)

    class Meta:
        model = CustomUser
        fields = ["username", "fullname", "email", "profile", "password"]

    def update(self, instance, validated_data):
        # Profile ma'lumotlarini alohida ajratib olamiz
        profile_data = validated_data.pop("profile", None)

        # User ma'lumotlarini yangilash
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Agar profile bo'lsa uni ham yangilash
        if profile_data:
            profile = instance.profile.first()
            if profile:
                for attr, value in profile_data.items():
                    setattr(profile, attr, value)
                profile.save()
            else:
                UserProfile.objects.create(user=instance, **profile_data)

        return instance