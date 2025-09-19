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

  const handleSave = () => {
    console.log("Saving profile:", editData)
    setIsEditing(false)
  }

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
            <DialogTitle>{isOwnProfile ? "Mening profilim" : "Foydalanuvchi profili"}</DialogTitle>
            {isOwnProfile && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
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
              {user.isOnline && (
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 border-4 border-background rounded-full" />
              )}
            </div>

            {isEditing ? (
              <div className="w-full space-y-3">
                <div>
                  <Label htmlFor="edit-name">To'liq ism</Label>
                  <Input
                    id="edit-name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-bio">Bio</Label>
                  <Input
                    id="edit-bio"
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    placeholder="O'zingiz haqingizda yozing..."
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Telefon</Label>
                  <Input
                    id="edit-phone"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  />
                </div>
                <Button onClick={handleSave} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Saqlash
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-2">
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-muted-foreground">@{user.username}</p>
                {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
                <div className="flex items-center justify-center gap-2">
                  {user.role && (
                    <Badge variant="secondary">
                      <Shield className="mr-1 h-3 w-3" />
                      {user.role}
                    </Badge>
                  )}
                  <Badge variant={user.isOnline ? "default" : "secondary"}>
                    {user.isOnline ? "Onlayn" : `Oxirgi: ${user.lastSeen}`}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {!isEditing && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info">Ma'lumot</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {user.phone && (
                    <div>
                      <Label className="text-sm font-medium">Telefon</Label>
                      <p className="text-sm text-muted-foreground">{user.phone}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Foydalanuvchi nomi</Label>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">Umumiy media fayllari yo'q</p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!isOwnProfile && !isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleStartChat} className="flex-1">
                <MessageSquare className="mr-2 h-4 w-4" />
                Xabar
              </Button>
              <Button variant="outline" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Video className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={user.isContact ? handleRemoveContact : handleAddContact}>
                {user.isContact ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
