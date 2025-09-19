import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "./ui/select"
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
import { apiClient } from "@/lib/api"

interface GroupInfoModalProps {
  isOpen: boolean
  onClose: () => void
  group: {
    id: number
    name: string
    description: string
    avatar: string
    memberCount: number
  }
}

interface GroupMember {
  id: number
  group: number
  user: number
  user_fullname: string
  user_username: string
  role: "owner" | "admin" | "member"
  joined_at: string
  is_online?: boolean
}

export function GroupInfoModal({ isOpen, onClose, group }: GroupInfoModalProps) {
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member">("member");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin'>('member');
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [username, setUsername] = useState<any>(null);
  const [editData, setEditData] = useState({
    name: group.name,
    description: group.description,
  })
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadGroupMembers()
    }
  }, [isOpen, group.id])

  const loadGroupMembers = async () => {
    try {
      setLoading(true)
      const membersData = await apiClient.getGroupMembers(group.id)
      setMembers(membersData)
      const currentUser = await apiClient.getMe();
      const currentUserId = currentUser.id;
      const currentUserMember = membersData.find((member: GroupMember) =>
        member.user === currentUserId
      );

      if (currentUserMember) {
        setUserRole(currentUserMember.role);
        setIsAdmin(currentUserMember.role === "owner" || currentUserMember.role === "admin");
      }
    } catch (error) {
      console.error("Failed to load group members:", error)
    } finally {
      setLoading(false)
    }
  }

  const checkUsername = async () => {
    if (!username.trim()) {
      setUserExists(null);
      setFoundUser(null);
      return;
    }

    try {
      const users = await apiClient.searchUser(username);

      const user = users.find((u: any) =>
        u.username.toLowerCase() === username.toLowerCase().trim()
      );

      if (user) {
        const isAlreadyMember = members.some((member: GroupMember) => member.user === user.id);

        if (isAlreadyMember) {
          setUserExists(false);
          setFoundUser(null);
          alert("Bu foydalanuvchi allaqachon guruhda mavjud");
        } else {
          setUserExists(true);
          setFoundUser(user);
        }
      } else {
        setUserExists(false);
        setFoundUser(null);
      }
    } catch (error) {
      console.error("Failed to check username:", error);
      setUserExists(false);
      setFoundUser(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      checkUsername();
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSave = async () => {
    try {
      await apiClient.updateGroup(group.id, editData)
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update group:", error)
    }
  }

  const handleMakeAdmin = async (userId: number) => {
    try {
      await apiClient.updateGroupMemberRole(group.id, userId, 'admin');
      await loadGroupMembers();
      alert("Foydalanuvchi admin qilindi");
    } catch (error: any) {
      console.error("Failed to make admin:", error);
      alert(error.message || "Admin qilishda xatolik yuz berdi");
    }
  };

  const handleRemoveAdmin = async (userId: number) => {
    try {
      await apiClient.updateGroupMemberRole(group.id, userId, 'member');
      await loadGroupMembers();
      alert("Foydalanuvchi adminlikdan olindi");
    } catch (error: any) {
      console.error("Failed to remove admin:", error);
      alert(error.message || "Adminlikdan olishda xatolik yuz berdi");
    }
  };

  const handleRemoveMember = async (groupId: number, userId: number) => {
    try {
      await apiClient.removeGroupMember(groupId, userId);
      await loadGroupMembers();
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await apiClient.leaveGroup(group.id)
      onClose()
    } catch (error) {
      console.error("Failed to leave group:", error)
    }
  }

  const loadAvailableUsers = async () => {
    try {
      const users = await apiClient.searchUsers("");
      const nonMembers = users.filter((user: any) =>
        !members.some((member: GroupMember) => member.user === user.id)
      );
      setAvailableUsers(nonMembers);
    } catch (error) {
      console.error("Failed to load available users:", error);
    }
  };

  const handleAddMember = async () => {
    if (!foundUser) {
      alert("Iltimos, avval foydalanuvchini toping");
      return;
    }

    try {
      const addData = {
        group: group.id,
        user: foundUser.id,
        role: selectedRole
      };

      await apiClient.addGroupMember(addData);

      setUsername("");
      setSelectedRole('member');
      setUserExists(null);
      setFoundUser(null);

      await loadGroupMembers();

      alert(`${foundUser.username} guruhga muvaffaqiyatli qo'shildi`);

    } catch (error: any) {
      console.error("Failed to add member:", error);
      alert(error.message || "Foydalanuvchi qo'shishda xatolik yuz berdi");
    }
  };

  const getRoleBadge = (role: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Badge variant="default" className="bg-yellow-500">
          <Crown className="mr-1 h-3 w-3" />
          Owner
        </Badge>
      )
    }

    switch (role) {
      case "admin":
        return (
          <Badge variant="default" className="bg-blue-500">
            <Shield className="mr-1 h-3 w-3" />
            Admin
          </Badge>
        )
      case "member":
        return (
          <Badge variant="outline">
            Member
          </Badge>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uz-UZ", {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Guruh ma'lumotlari</DialogTitle>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={group.avatar || "/group-avatar.png"} />
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
                  <div className="flex gap-2">
                    <Button onClick={handleSave} size="sm">
                      <Save className="mr-2 h-4 w-4" />
                      Saqlash
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)} size="sm">
                      Bekor qilish
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold">{group.name}</h3>
                  <p className="text-muted-foreground">{group.description || "Tavsif mavjud emas"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {members.length} a'zo
                    </Badge>
                    {isAdmin && (
                      <Badge variant="default">
                        <Shield className="mr-1 h-3 w-3" />
                        {userRole}
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
                  <h4 className="font-medium">Guruh a'zolari ({members.length})</h4>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAddMemberModal(true);
                        loadAvailableUsers();
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      A'zo qo'shish
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-64">
                  {loading ? (
                    <div className="text-center py-8">
                      <p>Yuklanmoqda...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src="/diverse-group.png" />
                              <AvatarFallback>{member.user_fullname?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            {member.is_online && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm truncate">{member.user_fullname}</h3>
                              {getRoleBadge(member.role, member.role === "owner")}
                            </div>
                            <p className="text-xs text-muted-foreground">@{member.user_username}</p>
                            <p className="text-xs text-muted-foreground">
                              Qo'shildi: {formatDate(member.joined_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            {isAdmin && member.role !== "owner" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {member.role === "admin" ? (
                                    <DropdownMenuItem onClick={() => handleRemoveAdmin(member.user)}>
                                      <UserMinus className="mr-2 h-4 w-4" />
                                      Adminlikdan olish
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleMakeAdmin(member.user)}>
                                      <Shield className="mr-2 h-4 w-4" />
                                      Admin qilish
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleRemoveMember(group.id, member.user)}
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
                  )}
                </ScrollArea>
              </TabsContent>

              <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Guruhga a'zo qo'shish</DialogTitle>
                    <DialogDescription>
                      Foydalanuvchi username ni kiriting va rolini tanlang
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="username kiriting..."
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="role-select">Rol</Label>
                      <Select value={selectedRole} onValueChange={(value: 'member' | 'admin') => setSelectedRole(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Rol tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">A'zo</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddMemberModal(false);
                          setUsername("");
                          setSelectedRole('member');
                          setUserExists(null);
                          setFoundUser(null);
                        }}
                      >
                        Bekor qilish
                      </Button>
                      <Button
                        onClick={handleAddMember}
                        disabled={!foundUser || !selectedRole}
                      >
                        Qo'shish
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
                        <Button variant="outline" size="sm" disabled={!isAdmin}>
                          O'zgartirish
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">A'zo qo'shish huquqi</p>
                          <p className="text-xs text-muted-foreground">Barcha a'zolar yangi a'zo qo'sha oladi</p>
                        </div>
                        <Button variant="outline" size="sm" disabled={!isAdmin}>
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