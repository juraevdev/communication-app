import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MessageSquare, Phone, MoreVertical } from "lucide-react"
import { UserProfileModal } from "./user-profile-modal"
import { apiClient } from "@/lib/api"

interface ContactsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Contact {
  id: number;
  alias: string;
  image: string;
  owner: number;
  contact_user: number;
  phone_number: string;
  email: string;
  bio: string;
  isContact: boolean;
  isOnline: boolean;
  avatar: string
  is_online: boolean;
  unread_count: number;
  name: string;
  username: string;
  lastSeen: string;
  role: string;
}


export function ContactsModal({ isOpen, onClose }: ContactsModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<Contact | null>(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchContacts = async () => {
      if (!isOpen) return;
      
      setIsLoading(true)
      setError(null)
      try {
        const contactsData = await apiClient.getContacts()
        console.log("API dan kelgan kontaktlar:", contactsData); 
        setContacts(Array.isArray(contactsData) ? contactsData : [])
      } catch (err) {
        setError("Kontaktlarni yuklab bo'lmadi")
        console.error("Kontaktlarni yuklashda xato:", err)
        setContacts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchContacts()
  }, [isOpen])

  const filteredContacts = (contacts || []).filter((contact) => {
    if (!contact) return false;
    
    const alias = contact.alias || "";
    const username = contact.alias || ""; 
    
    return (
      alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleUserClick = (user: Contact) => {
    setSelectedUser(user)
    setShowUserProfile(true)
  }

  const handleStartChat = (user: Contact) => {
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
                placeholder="Search..."
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
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <p>Loading...</p>
                    </div>
                  ) : error ? (
                    <div className="flex justify-center items-center h-40">
                      <p className="text-red-500">{error}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={contact.image || "/placeholder.svg"} />
                              <AvatarFallback>{(contact.alias || "U").charAt(0)}</AvatarFallback>
                            </Avatar> 
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => handleUserClick(contact)}>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm truncate">{contact.alias || "Unknown"}</h3>
                              {contact.role && (
                                <Badge variant="secondary" className="text-xs">
                                  {contact.role}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">@{contact.alias || "user"}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              className="cursor-pointer" 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleStartChat(contact)}
                            >
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
                      
                      {filteredContacts.length === 0 && searchQuery && (
                        <div className="text-center py-8">
                          <p>No contacts</p>
                        </div>
                      )}
                      
                      {filteredContacts.length === 0 && !searchQuery && !isLoading && (
                        <div className="text-center py-8">
                          <p>Not found</p>
                        </div>
                      )}
                    </div>
                  )}
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