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


    def test_create_message(self):
        url = reverse('message-create') 
        data = {
            'sender': self.user1.id,
            'recipient': self.user2.id,
            'text': 'Salom!'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)


    def test_list_messages(self):
        url = reverse('message-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)


    def test_delete_message(self):
        message = Message.objects.create(sender=self.user1, recipient=self.user2, text='Test message')
        url = reverse('message-delete', args=[message.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Message.objects.count(), 0)


    def test_update_message(self):
        message = Message.objects.create(sender=self.user1, recipient=self.user2, text='Old message')
        url = reverse('message-edit', args=[message.id])
        data = {
            'sender': self.user1.id,
            'recipient': self.user2.id,
            'text': 'Updated message'
        }
        response = self.client.put(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        message.refresh_from_db()
        self.assertEqual(message.text, 'Updated message')