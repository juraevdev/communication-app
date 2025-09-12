from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    def has_permission(self, request, view):
        user = request.user 
        
        
class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user