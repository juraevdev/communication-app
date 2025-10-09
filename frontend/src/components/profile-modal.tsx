import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare } from "lucide-react"

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
    phone_number?: string
    isContact: boolean
    isOnline: boolean
    lastSeen: string
    role?: string
  }
  isOwnProfile?: boolean
}

export function ProfileModal({ isOpen, onClose, user, isOwnProfile = false }: ProfileModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }

  const getAvatarFallback = () => {
    if (!user.name) return "U" 
    return user.name.charAt(0).toUpperCase()
  }

  const handleStartChat = () => {
    console.log("Starting chat with:", user.id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-gray-300">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle></DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-lg">{getAvatarFallback()}</AvatarFallback>
              </Avatar>
            </div>
            <div className="w-full space-y-2">
              <h3 className="text-xl font-semibold">{user.name || ""}</h3>
              <p className="text-muted-foreground">@{user.username || "user"}</p>
            </div>
          </div>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-">
              <TabsTrigger className="cursor-pointer" value="info">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{user.email || "No email"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <p className="text-sm text-muted-foreground">@{user.username || "user"}</p>
                </div>
                {user.bio && (
                  <div>
                    <Label className="text-sm font-medium">Bio</Label>
                    <p className="text-sm text-muted-foreground">{user.bio}</p>
                  </div>
                )}
                {user.phone_number && (
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {!isOwnProfile && (
            <div className="flex gap-2">
              <Button onClick={handleStartChat} className="flex-1 cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" />
                Message
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}