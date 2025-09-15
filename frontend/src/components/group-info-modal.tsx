"use client"

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
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
} from "lucide-react"

interface GroupInfoModalProps {
  isOpen: boolean
  onClose: () => void
  group: {
    id: number
    name: string
    description: string
    avatar: string
    memberCount: number
    isAdmin: boolean
  }
}

// Mock group members data
const mockMembers = [
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

export function GroupInfoModal({ isOpen, onClose, group }: GroupInfoModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: group.name,
    description: group.description,
  })

  const handleSave = () => {
    // TODO: Implement save group info logic
    console.log("Saving group info:", editData)
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

  const handleRemoveMember = (userId: number) => {
    // TODO: Implement remove member logic
    console.log("Removing member:", userId)
  }

  const handleLeaveGroup = () => {
    // TODO: Implement leave group logic
    console.log("Leaving group:", group.id)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Guruh ma'lumotlari</DialogTitle>
            {group.isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Group Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={group.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-lg">{group.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-group-name">Guruh nomi</Label>
                    <Input
                      id="edit-group-name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-group-description">Tavsif</Label>
                    <Textarea
                      id="edit-group-description"
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button onClick={handleSave} size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Saqlash
                  </Button>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold">{group.name}</h3>
                  <p className="text-muted-foreground">{group.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {group.memberCount} a'zo
                    </Badge>
                    {group.isAdmin && (
                      <Badge variant="default">
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isEditing && (
            <Tabs defaultValue="members" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="members">A'zolar</TabsTrigger>
                <TabsTrigger value="settings">Sozlamalar</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Guruh a'zolari ({mockMembers.length})</h4>
                  {group.isAdmin && (
                    <Button size="sm" variant="outline">
                      <UserPlus className="mr-2 h-4 w-4" />
                      A'zo qo'shish
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {mockMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent">
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar || "/placeholder.svg"} />
                            <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {member.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{member.name}</h3>
                            {member.isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
                            {member.isAdmin && !member.isOwner && <Shield className="h-4 w-4 text-blue-500" />}
                            <Badge variant="outline" className="text-xs">
                              {member.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">@{member.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Qo'shildi: {new Date(member.joinedDate).toLocaleDateString("uz-UZ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          {group.isAdmin && !member.isOwner && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {member.isAdmin ? (
                                  <DropdownMenuItem onClick={() => handleRemoveAdmin(member.id)}>
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Adminlikdan olish
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleMakeAdmin(member.id)}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Admin qilish
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Guruhdan chiqarish
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
                    <h4 className="font-medium">Guruh sozlamalari</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Xabar yuborish huquqi</p>
                          <p className="text-xs text-muted-foreground">Faqat adminlar xabar yuborishi mumkin</p>
                        </div>
                        <Button variant="outline" size="sm" disabled={!group.isAdmin}>
                          O'zgartirish
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">A'zo qo'shish huquqi</p>
                          <p className="text-xs text-muted-foreground">Barcha a'zolar yangi a'zo qo'sha oladi</p>
                        </div>
                        <Button variant="outline" size="sm" disabled={!group.isAdmin}>
                          O'zgartirish
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="destructive" onClick={handleLeaveGroup} className="w-full">
                      <LogOut className="mr-2 h-4 w-4" />
                      Guruhdan chiqish
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
