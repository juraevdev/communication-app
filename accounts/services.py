from chat.models import Room

def get_or_create_room(user1, user2):
    if user1.id > user2.id:
        user1, user2 = user2, user1 

    room, created = Room.objects.get_or_create(user1=user1, user2=user2)
    return room
