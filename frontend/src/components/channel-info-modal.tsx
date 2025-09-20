import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Hash,
  UserPlus,
  MoreVertical,
  Shield,
  UserMinus,
  Crown,
  Edit,
  Save,
  X,
  MessageSquare,
  LogOut,
  Users,
  Lock,
  Globe,
  Bell,
  BellOff,
  Share,
  Copy,
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
    isAdmin: boolean
    isPrivate: boolean
    isSubscribed: boolean
    isMuted: boolean
  }
}

// Mock channel subscribers data
const mockSubscribers = [
  {
    id: 1,
    name: "Akmal Karimov",
    username: "akmal_k",
    avatar: "/diverse-group.png",
    role: "Developer",
    isOnline: true,
    isAdmin: true,
    isOwner: true,
    joinedDate: "2024-01-15",
  },
  {
    id: 2,
    name: "Malika Tosheva",
    username: "malika_t",
    avatar: "/diverse-group-meeting.png",
    role: "Manager",
    isOnline: false,
    isAdmin: true,
    isOwner: false,
    joinedDate: "2024-01-16",
  },
  {
    id: 3,
    name: "Bobur Aliyev",
    username: "bobur_a",
    avatar: "/news-collage.png",
    role: "Designer",
    isOnline: true,
    isAdmin: false,
    isOwner: false,
    joinedDate: "2024-01-17",
  },
  {
    id: 4,
    name: "Dilshod Rahimov",
    username: "dilshod_r",
    avatar: "/abstract-self.png",
    role: "Accountant",
    isOnline: false,
    isAdmin: false,
    isOwner: false,
    joinedDate: "2024-01-18",
  },
]

export function ChannelInfoModal({ isOpen, onClose, channel }: ChannelInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: channel.name,
    description: channel.description,
    username: channel.username,
    isPrivate: channel.isPrivate,
  })
  const [isMuted, setIsMuted] = useState(channel.isMuted)
  const [isSubscribed, setIsSubscribed] = useState(channel.isSubscribed)

  const handleSave = () => {
    // TODO: Implement save channel info logic
    console.log("Saving channel info:", editData)
    setIsEditing(false)
  }

  const handleMakeAdmin = (userId: number) => {
    // TODO: Implement make admin logic
    console.log("Making admin:", userId)
  }

  const handleRemoveAdmin = (userId: number) => {
    // TODO: Implement remove admin logic
    console.log("Removing admin:", userId)
  }

  const handleRemoveSubscriber = (userId: number) => {
    // TODO: Implement remove subscriber logic
    console.log("Removing subscriber:", userId)
  }

  const handleSubscribe = () => {
    setIsSubscribed(!isSubscribed)
    // TODO: Implement subscribe/unsubscribe logic
    console.log(isSubscribed ? "Unsubscribing from" : "Subscribing to", channel.id)
  }

  const handleMute = () => {
    setIsMuted(!isMuted)
    // TODO: Implement mute/unmute logic
    console.log(isMuted ? "Unmuting" : "Muting", channel.id)
  }

  const handleShareChannel = () => {
    const channelLink = `https://chatapp.gov.uz/channel/${channel.username}`
    navigator.clipboard.writeText(channelLink)
    alert("Kanal havolasi nusxalandi!")
  }

  const handleLeaveChannel = () => {
    // TODO: Implement leave channel logic
    console.log("Leaving channel:", channel.id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Kanal ma'lumotlari</DialogTitle>
            {channel.isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Channel Header */}
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
                    <Label htmlFor="edit-channel-name">Kanal nomi</Label>
                    <Input
                      id="edit-channel-name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-channel-username">Kanal manzili</Label>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1">@</span>
                      <Input
                        id="edit-channel-username"
                        value={editData.username}
                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-channel-description">Tavsif</Label>
                    <Textarea
                      id="edit-channel-description"
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {editData.isPrivate ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{editData.isPrivate ? "Shaxsiy kanal" : "Ochiq kanal"}</p>
                      </div>
                    </div>
                    <Switch
                      checked={editData.isPrivate}
                      onCheckedChange={(checked) => setEditData({ ...editData, isPrivate: checked })}
                    />
                  </div>
                  <Button onClick={handleSave} size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Saqlash
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{channel.name}</h3>
                    {channel.isPrivate ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-muted-foreground">@{channel.username}</p>
                  <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {channel.subscriberCount} obunachilar
                    </Badge>
                    {channel.isAdmin && (
                      <Badge variant="default">
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                    {channel.isPrivate && (
                      <Badge variant="outline">
                        <Lock className="mr-1 h-3 w-3" />
                        Shaxsiy
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <>
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleSubscribe} variant={isSubscribed ? "outline" : "default"}>
                  {isSubscribed ? "Obunani bekor qilish" : "Obuna bo'lish"}
                </Button>
                <Button variant="outline" onClick={handleMute}>
                  {isMuted ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                  {isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
                </Button>
                <Button variant="outline" onClick={handleShareChannel}>
                  <Share className="mr-2 h-4 w-4" />
                  Ulashish
                </Button>
              </div>

              <Tabs defaultValue="subscribers" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="subscribers">Obunachilar</TabsTrigger>
                  <TabsTrigger value="settings">Sozlamalar</TabsTrigger>
                </TabsList>

                <TabsContent value="subscribers" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Kanal obunachilari ({mockSubscribers.length})</h4>
                    {channel.isAdmin && (
                      <Button size="sm" variant="outline">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Obunachilar
                      </Button>
                    )}
                  </div>

                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {mockSubscribers.map((subscriber) => (
                        <div key={subscriber.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={subscriber.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{subscriber.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {subscriber.isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm truncate">{subscriber.name}</h3>
                              {subscriber.isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
                              {subscriber.isAdmin && !subscriber.isOwner && (
                                <Shield className="h-4 w-4 text-blue-500" />
                              )}
                              <Badge variant="outline" className="text-xs">
                                {subscriber.role}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">@{subscriber.username}</p>
                            <p className="text-xs text-muted-foreground">
                              Obuna: {new Date(subscriber.joinedDate).toLocaleDateString("uz-UZ")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            {channel.isAdmin && !subscriber.isOwner && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {subscriber.isAdmin ? (
                                    <DropdownMenuItem onClick={() => handleRemoveAdmin(subscriber.id)}>
                                      <UserMinus className="mr-2 h-4 w-4" />
                                      Adminlikdan olish
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleMakeAdmin(subscriber.id)}>
                                      <Shield className="mr-2 h-4 w-4" />
                                      Admin qilish
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleRemoveSubscriber(subscriber.id)}
                                  >
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Kanaldan chiqarish
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">Kanal sozlamalari</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">Xabar yuborish huquqi</p>
                            <p className="text-xs text-muted-foreground">Faqat adminlar xabar yuborishi mumkin</p>
                          </div>
                          <Button variant="outline" size="sm" disabled={!channel.isAdmin}>
                            O'zgartirish
                          </Button>
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">Kanal havolasi</p>
                            <p className="text-xs text-muted-foreground">@{channel.username}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={handleShareChannel}>
                            <Copy className="mr-2 h-4 w-4" />
                            Nusxalash
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Button variant="destructive" onClick={handleLeaveChannel} className="w-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        Kanaldan chiqish
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
