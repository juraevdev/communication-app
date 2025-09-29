from rest_framework.permissions import BasePermission

from groups.models import GroupMember, Group

class IsGroupOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            return GroupMember.objects.filter(
                group=obj, 
                user=request.user, 
                role='owner'
            ).exists()
        return False

class IsGroupAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Group):
            return GroupMember.objects.filter(
                group=obj, 
                user=request.user, 
                role='admin'
            ).exists()
        return False

class IsGroupOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        return (IsGroupOwner().has_object_permission(request, view, obj) or 
                IsGroupAdmin().has_object_permission(request, view, obj))