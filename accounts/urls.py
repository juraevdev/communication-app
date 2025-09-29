from django.urls import path
from accounts.views import (
    RegisterApiView, LoginApiView, 
    UserSearchApiView, UserFilterApiView, 
    UserUpdateApiView, ChangePasswordView, 
    ContactApiView, ContactSearchApiView, 
    ContactListApiView, ContactDeleteApiView, 
    ContactUpdateApiView, MeApiView, GetUserApiView
)


urlpatterns = [
    path('register/', RegisterApiView.as_view()),
    path('login/', LoginApiView.as_view()),
    path('filter/', UserFilterApiView.as_view()),
    path('users/search/', UserSearchApiView.as_view()),
    path('user/<int:id>/', GetUserApiView.as_view()),
    path('user/edit/', UserUpdateApiView.as_view()),
    path('contact/', ContactApiView.as_view()),
    path('contact/all/', ContactListApiView.as_view()),
    path('contact/filter/', ContactSearchApiView.as_view()),
    path('contact/delete/<int:id>/', ContactDeleteApiView.as_view()),
    path('contact/edit/<int:id>/', ContactUpdateApiView.as_view()),
    path('me/', MeApiView.as_view()),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
]