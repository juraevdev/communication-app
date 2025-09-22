import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MessageSquare, Phone, MoreVertical } from "lucide-react"
import { UserProfileModal } from "./user-profile-modal"

interface ContactsModalProps {
  isOpen: boolean
  onClose: () => void
}

const mockContacts = [
  {
    id: 1,
    name: "Akmal Karimov",
    username: "akmal_k",
    email: "akmal@company.gov.uz",
    avatar: "/diverse-group.png",
    bio: "IT mutaxassisi",
    phone_number: "+998901234567",
    isContact: true,
    isOnline: true,
    lastSeen: "2 daqiqa oldin",
    role: "Developer",
  },
  {
    id: 2,
    name: "Malika Tosheva",
    username: "malika_t",
    email: "malika@company.gov.uz",
    avatar: "/diverse-group-meeting.png",
    bio: "Loyiha menejeri",
    phone_number: "+998901234568",
    isContact: true,
    isOnline: false,
    lastSeen: "1 soat oldin",
    role: "Manager",
  },
  {
    id: 3,
    name: "Bobur Aliyev",
    username: "bobur_a",
    email: "bobur@company.gov.uz",
    avatar: "/news-collage.png",
    bio: "Dizayner",
    phone_number: "+998901234569",
    isContact: true,
    isOnline: true,
    lastSeen: "Hozir",
    role: "Designer",
  },
]

export function ContactsModal({ isOpen, onClose }: ContactsModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<(typeof mockContacts)[0] | null>(null)
  const [showUserProfile, setShowUserProfile] = useState(false)

  const filteredContacts = mockContacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )


  const handleUserClick = (user: (typeof mockContacts)[0]) => {
    setSelectedUser(user)
    setShowUserProfile(true)
  }

  const handleStartChat = (user: (typeof mockContacts)[0]) => {
    console.log("Starting chat with:", user.id)
    onClose()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-gray-300">
          <DialogHeader>
            <DialogTitle>Contacts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Foydalanuvchi qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="cursor-pointer" value="contacts">Contact</TabsTrigger>
              </TabsList>

              <TabsContent value="contacts">
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={contact.avatar || "/placeholder.svg"} />
                            <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {contact.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-background rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0" onClick={() => handleUserClick(contact)}>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{contact.name}</h3>
                            {contact.role && (
                              <Badge variant="secondary" className="text-xs">
                                {contact.role}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">@{contact.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {contact.isOnline ? "Onlayn" : contact.lastSeen}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button className="cursor-pointer" variant="ghost" size="sm" onClick={() => handleStartChat(contact)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button className="cursor-pointer" variant="ghost" size="sm">
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button className="cursor-pointer" variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <UserProfileModal
          isOpen={showUserProfile}
          onClose={() => {
            setShowUserProfile(false)
            setSelectedUser(null)
          }}
          user={selectedUser}
        />
      )}
    </>
  )
}
