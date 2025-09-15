import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Search, Users, X } from "lucide-react"

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
}

const mockUsers = [
  {
    id: 1,
    name: "Akmal Karimov",
    username: "akmal_k",
    avatar: "/diverse-group.png",
    role: "Developer",
    isOnline: true,
  },
  {
    id: 2,
    name: "Malika Tosheva",
    username: "malika_t",
    avatar: "/diverse-group-meeting.png",
    role: "Manager",
    isOnline: false,
  },
  {
    id: 3,
    name: "Bobur Aliyev",
    username: "bobur_a",
    avatar: "/news-collage.png",
    role: "Designer",
    isOnline: true,
  },
  {
    id: 4,
    name: "Dilshod Rahimov",
    username: "dilshod_r",
    avatar: "/abstract-self.png",
    role: "Accountant",
    isOnline: false,
  },
  {
    id: 5,
    name: "Sevara Nazarova",
    username: "sevara_n",
    avatar: "/diverse-group.png",
    role: "HR",
    isOnline: true,
  },
]

export function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const [step, setStep] = useState(1)
  const [groupData, setGroupData] = useState({
    name: "",
    description: "",
    avatar: "",
  })
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleUserToggle = (userId: number) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const handleCreateGroup = () => {
    console.log("Creating group:", {
      ...groupData,
      members: selectedUsers,
    })
    alert("Guruh muvaffaqiyatli yaratildi!")
    onClose()
    setStep(1)
    setGroupData({ name: "", description: "", avatar: "" })
    setSelectedUsers([])
    setSearchQuery("")
  }

  const handleNext = () => {
    if (step === 1 && groupData.name.trim()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-300">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Yangi guruh yaratish" : "A'zolarni tanlash"}</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Guruh ma'lumotlarini kiriting" : "Guruhga qo'shmoqchi bo'lgan a'zolarni tanlang"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Guruh nomi *</Label>
              <Input
                id="group-name"
                placeholder="Guruh nomini kiriting"
                value={groupData.name}
                onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-description">Tavsif</Label>
              <Textarea
                id="group-description"
                placeholder="Guruh haqida qisqacha ma'lumot"
                value={groupData.description}
                onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Bekor qilish
              </Button>
              <Button onClick={handleNext} disabled={!groupData.name.trim()}>
                Keyingi
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Foydalanuvchi qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tanlangan a'zolar ({selectedUsers.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((userId) => {
                    const user = mockUsers.find((u) => u.id === userId)
                    return user ? (
                      <Badge key={userId} variant="secondary" className="flex items-center gap-1">
                        {user.name}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => handleUserToggle(userId)} />
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* User list */}
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => handleUserToggle(user.id)}
                  >
                    <Checkbox checked={selectedUsers.includes(user.id)} onChange={() => handleUserToggle(user.id)} />
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {user.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 border border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">{user.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                Orqaga
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Bekor qilish
                </Button>
                <Button onClick={handleCreateGroup}>
                  <Users className="mr-2 h-4 w-4" />
                  Guruh yaratish
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}