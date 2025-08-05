from django.urls import path
from accounts.views import RegisterApiView, LoginApiView, UserProfileApiView


urlpatterns = [
    path('register/', RegisterApiView.as_view()),
    path('login/', LoginApiView.as_view()),
    path('profile/', UserProfileApiView.as_view()),
]