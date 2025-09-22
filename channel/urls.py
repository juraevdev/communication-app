from django.urls import path

from channel.views import (
    ChannelApiView, ChannelListApiView,
    ChannelDetailApiView, ChannelUpdateApiView,
    ChannelDeleteApiView, FollowChannelApiView,
    UnFollowChannelApiView
)

urlpatterns = [
    path('create/', ChannelApiView.as_view()),
    path('list/', ChannelListApiView.as_view()),
    path('<int:id>/', ChannelDetailApiView.as_view()),
    path('edit/<int:id>/', ChannelUpdateApiView.as_view()),
    path('delete/<int:id>/', ChannelDeleteApiView.as_view()),
    path('follow/', FollowChannelApiView.as_view()),
    path('unfollow/', UnFollowChannelApiView.as_view()),
]