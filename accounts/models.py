from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator


from accounts.managers import CustomUserManager


class CustomUser(AbstractUser):
    username = None
    fullname = models.CharField(max_length=100, unique=True)
    email = models.EmailField(unique=True)


    USERNAME_FIELD = 'fullname'
    REQUIRED_FIELDS = ['email']


    objects = CustomUserManager()


    def __str__(self):
        return self.fullname
    


class UserProfile(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, unique=True, validators=[
                                    RegexValidator(regex=r'^\+998\d{9}$', message="Telefon raqam noto'g'ri formatda")])
    

    def __str__(self):
        return f'{self.user} - {self.phone_number}'