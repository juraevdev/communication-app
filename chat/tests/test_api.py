from rest_framework.test import APITestCase
from rest_framework import status

from django.urls import reverse
from chat.models import Message
from accounts.models import CustomUser


class MessageApiTests(APITestCase):
    def setUp(self):
        self.user1 = CustomUser.objects.create_user(fullname='user3', email='user7@example.com', password='pass123')
        self.user2 = CustomUser.objects.create_user(fullname='user4', email='user8@example.com', password='pass123')
        self.client.force_authenticate(user=self.user1)


    def test_list_messages(self):
        url = reverse('message-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
