from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

from accounts.managers import CustomUserManager


class CustomUser(AbstractUser):
    username = models.CharField(max_length=20, unique=True, null=True)
    fullname = models.CharField(max_length=100, unique=True)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=15, unique=True, null=True,
        validators=
        [RegexValidator(regex=r'^\+998\d{9}$', message="Telefon raqam noto'g'ri formatda")])
    is_online = models.BooleanField(default=False, null=True)
    last_seen = models.DateTimeField(null=True, blank=True)


    USERNAME_FIELD = 'fullname'
    REQUIRED_FIELDS = ['email'] 


    objects = CustomUserManager()


    def __str__(self):
        return self.fullname
    

class Contact(models.Model):
    owner = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="my_contacts", null=True)
    contact_user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="contact_of", null=True)
    alias = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return self.alias