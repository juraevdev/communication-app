from django.urls import path
from accounts.views import (
    RegisterApiView, LoginApiView, 
    UserProfileApiView, ProfileListApiView,
    ContactApiView, ContactSearchApiView, 
    ContactListApiView, MeApiView, UserFilterApiView,
    ChangePasswordView, UserUpdateApiView
)


urlpatterns = [
    path('register/', RegisterApiView.as_view()),
    path('login/', LoginApiView.as_view()),
    path('profile/', UserProfileApiView.as_view()),
    path('profile/all/', ProfileListApiView.as_view()),
    path('contact/', ContactApiView.as_view()),
    path('contact/all/', ContactListApiView.as_view()),
    path('contact/filter/', ContactSearchApiView.as_view()),
    path('me/', MeApiView.as_view()),
    path('filter/', UserFilterApiView.as_view()),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('user/', UserUpdateApiView.as_view()),
]