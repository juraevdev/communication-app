from django.contrib import admin

from groups.models import Group, GroupMember, GroupMessage

admin.site.register(Group)
admin.site.register(GroupMember)
admin.site.register(GroupMessage)
