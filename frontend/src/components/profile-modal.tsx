import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Phone, Video, UserPlus, UserMinus, Shield, Edit, Save, X } from "lucide-react"

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: number
    name: string
    username: string
    email: string
    avatar: string
    bio: string
    phone: string
    isContact: boolean
    isOnline: boolean
    lastSeen: string
    role?: string
  }
  isOwnProfile?: boolean
}

export function ProfileModal({ isOpen, onClose, user, isOwnProfile = false }: ProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: user.name,
    bio: user.bio,
    phone: user.phone,
  })

  const handleAddContact = () => {
    console.log("Adding contact:", user.id)
  }

  const handleRemoveContact = () => {
    console.log("Removing contact:", user.id)
  }

  const handleStartChat = () => {
    console.log("Starting chat with:", user.id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-300">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isOwnProfile ? "Mening profilim" : ""}</DialogTitle>
            {isOwnProfile && (
              <Button className="cursor-pointer" variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-lg">{user.name}</AvatarFallback>
              </Avatar>
            </div>
              <div className="w-full space-y-2">
                <h3 className="text-xl font-semibold">{user.name}</h3>
              </div>
          </div>

            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="cursor-pointer" value="info">Info</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="media">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Username</Label>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">No media</p>
                </div>
              </TabsContent>
            </Tabs>

          {!isOwnProfile && !isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleStartChat} className="flex-1 cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Message
              </Button>
              <Button variant="outline" size="icon" className="cursor-pointer">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="cursor-pointer">
                <Video className="h-4 w-4" />
              </Button>
              <Button className="cursor-pointer" variant="outline" size="icon" onClick={user.isContact ? handleRemoveContact : handleAddContact}>
                {user.isContact ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
