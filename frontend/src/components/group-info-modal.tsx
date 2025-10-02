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
  onGroupUpdate?: () => void
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

export function GroupInfoModal({ isOpen, onClose, group, onGroupUpdate }: GroupInfoModalProps) {
  const [userRole, setUserRole] = useState<"owner" | "admin" | "member">("member");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [, setAvailableUsers] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<'member' | 'admin'>('member');
  const [, setUserExists] = useState<boolean | null>(null);
  const [foundUser, setFoundUser] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState<any>(null);
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

  const checkPhoneNumber = async () => {
    if (!phoneNumber) {
      setUserExists(null);
      setFoundUser(null);
      return;
    }

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const users = await apiClient.searchUser(cleanPhone);

      if (users && users.length > 0) {
        const user = users[0];
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
      console.error("Failed to check phone number:", error);
      setUserExists(false);
      setFoundUser(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (phoneNumber && phoneNumber.length >= 9) {
        checkPhoneNumber();
      } else {
        setUserExists(null);
        setFoundUser(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [phoneNumber]);

  const handleSave = async () => {
    try {
      await apiClient.updateGroup(group.id, editData)
      setIsEditing(false)

      if (onGroupUpdate) {
        onGroupUpdate()
      }

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

      if (onGroupUpdate) {
        onGroupUpdate()
      }

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

      setPhoneNumber("");
      setSelectedRole('member');
      setUserExists(null);
      setFoundUser(null);

      await loadGroupMembers();

      alert(`${foundUser.fullname || foundUser.username} guruhga muvaffaqiyatli qo'shildi`);

    } catch (error: any) {
      console.error("Failed to add member:", error);
      alert(error.message || "Foydalanuvchi qo'shishda xatolik yuz berdi");
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Faqat raqamlarni qoldirish
    const numbers = value.replace(/\D/g, '');

    // Formatlash: +998 XX XXX-XX-XX
    if (numbers.length === 0) return '';
    if (numbers.length <= 3) return `+${numbers}`;
    if (numbers.length <= 5) return `+${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    if (numbers.length <= 8) return `+${numbers.slice(0, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5)}`;
    if (numbers.length <= 10) return `+${numbers.slice(0, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5, 8)}-${numbers.slice(8)}`;
    return `+${numbers.slice(0, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5, 8)}-${numbers.slice(8, 10)}-${numbers.slice(10, 12)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
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
            <DialogTitle>Group Info</DialogTitle>
            {isAdmin && (
              <Button className="cursor-pointer" variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
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
                    <Label htmlFor="edit-group-name">Group name</Label>
                    <Input
                      id="edit-group-name"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-group-description">Description</Label>
                    <Textarea
                      id="edit-group-description"
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="cursor-pointer shadow-lg hover:scale-105 transition duration-300" onClick={handleSave} size="sm">
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button className="cursor-pointer hover:scale-105 transition duration-300" variant="outline" onClick={() => setIsEditing(false)} size="sm">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold">{group.name}</h3>
                  <p className="text-muted-foreground">{group.description || "No description"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {members.length} members
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
                <TabsTrigger className="cursor-pointer" value="members">Members</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Group members ({members.length})</h4>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setShowAddMemberModal(true);
                        loadAvailableUsers();
                      }}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add members
                    </Button>
                  )}
                </div>

                <ScrollArea className="h-64">
                  {loading ? (
                    <div className="text-center py-8">
                      <p>Loading...</p>
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
                              Joined: {formatDate(member.joined_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {isAdmin && member.role !== "owner" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button className="cursor-pointer" variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-gray-200">
                                  {member.role === "admin" ? (
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleRemoveAdmin(member.user)}>
                                      <UserMinus className="mr-2 h-4 w-4" />
                                      Dissmiss admin
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="cursor-pointer" onClick={() => handleMakeAdmin(member.user)}>
                                      <Shield className="mr-2 h-4 w-4" />
                                      Admin
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive cursor-pointer"
                                    onClick={() => handleRemoveMember(group.id, member.user)}
                                  >
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Remove member
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
                    <DialogTitle>Add members to group</DialogTitle>
                    <DialogDescription>
                      Enter phone number and role
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        placeholder="+998 XX XXX-XX-XX"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                      />
                      {foundUser && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                          <p className="text-sm text-green-800">
                            Found: {foundUser.fullname || foundUser.username} (@{foundUser.username})
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="role-select">Role</Label>
                      <Select value={selectedRole} onValueChange={(value: 'member' | 'admin') => setSelectedRole(value)}>
                        <SelectTrigger className="cursor-pointer">
                          <SelectValue placeholder="Choose role" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-200">
                          <SelectItem className="cursor-pointer" value="member">Member</SelectItem>
                          <SelectItem className="cursor-pointer" value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        className="cursor-pointer hover:scale-105 transition duration-300"
                        variant="outline"
                        onClick={() => {
                          setShowAddMemberModal(false);
                          setPhoneNumber("");
                          setSelectedRole('member');
                          setUserExists(null);
                          setFoundUser(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="cursor-pointer hover:scale-105 transition duration-300"
                        onClick={handleAddMember}
                        disabled={!foundUser || !selectedRole}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Group settings</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Message permission</p>
                          <p className="text-xs text-muted-foreground">Only admin can message</p>
                        </div>
                        <Button className="cursor-pointer" variant="outline" size="sm" disabled={!isAdmin}>
                          Change
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Add member permission</p>
                          <p className="text-xs text-muted-foreground">Everyone can add member</p>
                        </div>
                        <Button className="cursor-pointer" variant="outline" size="sm" disabled={!isAdmin}>
                          Change
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Button variant="destructive" onClick={handleLeaveGroup} className="w-full cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      Leave
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