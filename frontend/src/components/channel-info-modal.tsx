import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient } from "@/lib/api"

import {
  Hash,
  Edit,
  Save,
  X,
} from "lucide-react"

interface ChannelInfoModalProps {
  isOpen: boolean
  onClose: () => void
  channel: {
    id: number
    name: string
    description: string
    username: string
    avatar: string
    subscriberCount: number
    isOwner: boolean
    isPrivate: boolean
    isSubscribed: boolean
    isMuted: boolean
  }
  onChannelUpdate?: (channelId?: number, isSubscribed?: boolean) => void  
}

interface User {
  id: number
  username: string
  email: string
  full_name?: string
  avatar?: string
  is_online?: boolean
}

export function ChannelInfoModal({ isOpen, onClose, channel, onChannelUpdate }: ChannelInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null) 
  const [editData, setEditData] = useState({
    name: channel.name,
    description: channel.description,
    username: channel.username,
    isPrivate: channel.isPrivate,
  })
  const [isSubscribed, setIsSubscribed] = useState(channel.isSubscribed)

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const user = await apiClient.getMe();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error getting current user:", error);
      }
    };

    if (isOpen) {
      getCurrentUser();
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!channel.isOwner) {
      setIsEditing(false)
      alert("Sizda kanal ma'lumotlarini o'zgartirish huquqi yo'q")
      return
    }

    try {
      console.log("Saving channel info:", editData)
      await apiClient.updateChannel(channel.id, {
        name: editData.name,
        description: editData.description
      })
      setIsEditing(false)
      
      if (onChannelUpdate) {
        onChannelUpdate()
      }
    } catch (error) {
      console.error("Kanal ma'lumotlarini saqlashda xatolik:", error)
      alert("Kanal ma'lumotlarini saqlash muvaffaqiyatsiz tugadi")
    }
  }
  

const handleSubscribe = async () => {
  if (!currentUser) {
    console.error("No user logged in");
    alert("Iltimos, avval tizimga kiring");
    return;
  }

  try {
    if (isSubscribed) {
      await apiClient.unfollowChannel(channel.id, currentUser.id);
      console.log("Unsubscribed from", channel.id);
    } else {
      await apiClient.followChannel(channel.id, currentUser.id);
      console.log("Subscribed to", channel.id);
    }
    
    setIsSubscribed(!isSubscribed);
    
    if (onChannelUpdate) {
      onChannelUpdate(channel.id, !isSubscribed);   
    }
  } catch (error) {
    console.error("Subscription error:", error);
    alert("Amalni bajarishda xatolik yuz berdi");
  }
}

const handleLeaveChannel = async () => {
  if (!currentUser) {
    console.error("No user logged in");
    return;
  }

  try {
    await apiClient.unfollowChannel(channel.id, currentUser.id);
    console.log("Left channel:", channel.id);
    
    if (onChannelUpdate) {
      onChannelUpdate(channel.id, false);   
    }
    
    onClose();
  } catch (error) {
    console.error("Error leaving channel:", error);
  }
}

const handleSubscribeButtonClick = () => {
  if (isSubscribed) {
    handleLeaveChannel();
  } else {
    handleSubscribe();
  }
}

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-130 max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Channel Info</DialogTitle>
            {channel.isOwner && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={channel.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-lg">
                <Hash className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-channel-name">Channel name</Label>
                    <Input
                      id="edit-channel-name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-channel-username">Channel username</Label>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1"></span>
                      <Input
                        id="edit-channel-username"
                        value={editData.username}
                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-channel-description">Description</Label>
                    <Textarea
                      id="edit-channel-description"
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button className="cursor-pointer hover:scale-105 transition duration-300" onClick={handleSave} size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{channel.name}</h3>
                  </div>
                  <p className="text-muted-foreground">@{channel.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
                </div>
              )}
            </div>
          </div>
          
          {!isEditing && (
          <Tabs defaultValue="subscribers" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="subscribers">Channel Info</TabsTrigger>
            </TabsList>

            <div className="mt-3">
              <Label className="text-sm font-medium">Description:</Label>
              <p className="text-sm text-muted-foreground">
                {channel.description || "No description"}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Username</Label>
              <p className="text-sm text-muted-foreground">
                @{channel.username || "channel"} 
              </p>
            </div>
          </Tabs>
          )}

          {!isEditing && !channel.isOwner && ( 
            <div className="flex gap-2">
              <Button 
                className="cursor-pointer hover:scale-105 transition duration-300" 
                onClick={handleSubscribeButtonClick} 
                variant={isSubscribed ? "outline" : "default"}
              >
                {isSubscribed ? "Leave channel" : "Join channel"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}