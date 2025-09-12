from django.urls import path

from groups.views import (
    GroupApiView, GroupListApiView,
    GroupDetailApiView, GroupDeleteApiView,
    GroupUpdateApiView, GroupMemberAddApiView,
    GroupMemberDeleteApiView, GroupMembersApiView,
    GroupMessageListApiView,
)

urlpatterns = [
    path('create/', GroupApiView.as_view()),
    path('all/', GroupListApiView.as_view()),
    path('<int:id>/', GroupDetailApiView.as_view()),
    path('edit/<int:id>/', GroupUpdateApiView.as_view()),
    path('delete/<int:id>/', GroupDeleteApiView.as_view()),
    path('add-member/', GroupMemberAddApiView.as_view()),
    path('remove-member/<int:id>/', GroupMemberDeleteApiView.as_view()),
    path('members/<int:group_id>/', GroupMembersApiView.as_view()),
    path('group-messages/<int:group_id>/', GroupMessageListApiView.as_view()),
]