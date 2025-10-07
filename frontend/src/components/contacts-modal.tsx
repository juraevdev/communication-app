import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MessageSquare, UserPlus, X, Save, Edit } from "lucide-react"
import { UserProfileModal } from "./user-profile-modal"
import { apiClient } from "@/lib/api"
import { Label } from "./ui/label"

interface ContactsModalProps {
  isOpen: boolean
  onClose: () => void
  onStartChat: (userId: number) => void
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
  avatar: string;
  is_online: boolean;
  unread_count: number;
  name: string;
  username: string;
  lastSeen: string;
  role: string;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  avatar: string;
  phone_number: string;
  is_online: boolean;
  last_seen: string;
  role?: string;
}

export function ContactsModal({ isOpen, onClose, onStartChat }: ContactsModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<Contact | null>(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState("")
  const [newAlias, setNewAlias] = useState("")
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [addContactMessage, setAddContactMessage] = useState({ type: "", text: "" })
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editAlias, setEditAlias] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [targetUser, setTargetUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!isOpen) return;

      setIsLoading(true)
      setError(null)
      try {
        const contactsData = await apiClient.getContacts()
        console.log("API dan kelgan kontaktlar:", contactsData)
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

  useEffect(() => {
    const searchUsers = async () => {
      if (!newUsername.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const results = await apiClient.searchUsers(newUsername)
        setSearchResults(Array.isArray(results) ? results : [])
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchUsers, 500)
    return () => clearTimeout(timeoutId)
  }, [newUsername])

  const filteredContacts = contacts.filter((contact) => {
    if (!contact) return false;

    const alias = contact.alias || contact.name || ""
    const username = contact.username || ""

    return (
      alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // FIXED: handleAddContact - targetUser ni to'g'ri ishlatish
  const handleAddContact = async (user?: User) => {
    // Agar user parameter berilmasa, targetUser state dan foydalanish
    const userToAdd = user || targetUser;

    console.log("handleAddContact called");
    console.log("user parameter:", user);
    console.log("targetUser state:", targetUser);
    console.log("userToAdd:", userToAdd);

    if (!userToAdd?.id) {
      setAddContactMessage({ type: "error", text: "Iltimos, avval foydalanuvchini tanlang" })
      console.error("No user selected!");
      return
    }

    setIsAddingContact(true)
    setAddContactMessage({ type: "", text: "" })

    try {
      console.log("Adding contact with ID:", userToAdd.id);
      const result = await apiClient.addContact(
        userToAdd.id,
        newAlias || userToAdd.name || userToAdd.username
      )

      console.log("Contact added successfully:", result);

      setAddContactMessage({
        type: "success",
        text: "Kontakt muvaffaqiyatli qo'shildi"
      })
      
      // Form ni tozalash
      setNewUsername("")
      setNewAlias("")
      setSearchResults([])
      setTargetUser(null)

      // Kontaktlar ro'yxatini yangilash
      const contactsData = await apiClient.getContacts()
      setContacts(Array.isArray(contactsData) ? contactsData : [])

      // 2 soniyadan keyin success message ni o'chirish
      setTimeout(() => {
        setAddContactMessage({ type: "", text: "" })
      }, 2000)

    } catch (error: any) {
      console.error("Add contact error:", error)

      const backendError = error.response?.data?.error ||
        error.response?.data?.contact_user?.[0] ||
        error.response?.data?.non_field_errors?.[0] ||
        error.message

      setAddContactMessage({
        type: "error",
        text: backendError || "Kontakt qo'shish muvaffaqiyatsiz tugadi"
      })
    } finally {
      setIsAddingContact(false)
    }
  }

  const handleRemoveContact = async (contactId: number) => {
    try {
      await apiClient.removeContact(contactId)

      const contactsData = await apiClient.getContacts()
      setContacts(Array.isArray(contactsData) ? contactsData : [])

    } catch (error) {
      console.error("Failed to remove contact:", error)
      alert("Failed to remove contact")
    }
  }

  // FIXED: handleUserSelect - targetUser ni o'rnatish va search natijalarini yopish
  const handleUserSelect = (user: User) => {
    console.log("handleUserSelect called with:", user);
    setTargetUser(user);
    setNewUsername(user.username);
    setNewAlias(user.name || user.username);
    setSearchResults([]); // Search natijalarini yopish
    console.log("Target user set to:", user);
  }

  // newUsername o'zgarganda targetUser va searchResults ni tozalash
  useEffect(() => {
    if (!newUsername.trim()) {
      setTargetUser(null);
      setSearchResults([]);
    }
  }, [newUsername]);

  // FIXED: Add button holatini aniqlash
  const isAddButtonDisabled = isAddingContact || !targetUser;

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setEditAlias(contact.alias || contact.name || "")
  }

  const handleSaveEdit = async () => {
    if (!editingContact || !editAlias.trim()) return

    setIsEditing(true)
    try {
      await apiClient.updateContact(editingContact.id, editAlias)

      const contactsData = await apiClient.getContacts()
      setContacts(Array.isArray(contactsData) ? contactsData : [])

      setEditingContact(null)
      setEditAlias("")

    } catch (error) {
      console.error("Failed to update contact:", error)
      alert("Failed to update contact")
    } finally {
      setIsEditing(false)
    }
  }

  const handleUserClick = (user: Contact) => {
    setSelectedUser(user)
    setShowUserProfile(true)
  }

  const handleStartChat = (user: Contact) => {
    console.log("Starting chat with:", user)
    const userId = user.contact_user || user.id
    console.log("Using user ID:", userId)
    onStartChat(userId)
    onClose()
  }

  const handleClose = () => {
    setSearchQuery("")
    setNewUsername("")
    setNewAlias("")
    setAddContactMessage({ type: "", text: "" })
    setSearchResults([])
    setTargetUser(null)
    setEditingContact(null)
    setEditAlias("")
    onClose()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-gray-300">
          <DialogHeader>
            <DialogTitle>Contacts</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs defaultValue="contacts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="cursor-pointer" value="contacts">
                  Contacts ({contacts.length})
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="add-contacts">
                  Add Contact
                </TabsTrigger>
              </TabsList>

              <TabsContent value="contacts" className="space-y-4">
                <ScrollArea className="h-96">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={contact.avatar || contact.image || "/placeholder.svg"} />
                            <AvatarFallback>
                              {(contact.alias || contact.name || "U").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div
                            className="flex-1 min-w-0"
                            onClick={() => handleUserClick(contact)}
                          >
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-sm truncate">
                                {contact.alias || contact.name || "Unknown"}
                              </h3>
                              {contact.is_online && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              @{contact.username || "user"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              className="cursor-pointer"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartChat(contact)
                              }}
                              title="Start chat"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>

                            <Button
                              className="cursor-pointer"
                              variant="ghost"
                              size="sm"
                              title="Edit contact"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditContact(contact)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>

                            <Button
                              className="cursor-pointer"
                              variant="ghost"
                              size="sm"
                              title="Remove contact"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm("Are you sure you want to remove this contact?")) {
                                  handleRemoveContact(contact.id)
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {filteredContacts.length === 0 && searchQuery && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No contacts found</p>
                        </div>
                      )}

                      {filteredContacts.length === 0 && !searchQuery && !isLoading && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No contacts yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="add-contacts" className="space-y-4">
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="Enter username to search"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      disabled={isAddingContact}
                    />
                    {isSearching && (
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    )}
                  </div>

                  {/* FIXED: Search results display */}
                  {searchResults.length > 0 && !targetUser && (
                    <div className="space-y-2">
                      <Label>Search Results (Click to select):</Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent hover:border-blue-400 transition-all"
                            onClick={() => {
                              console.log("User selected:", user);
                              handleUserSelect(user);
                            }}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{user.name?.charAt(0) || user.username?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-sm">{user.name || user.username}</p>
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            </div>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FIXED: Selected user display */}
                  {targetUser && (
                    <div className="p-3 rounded-lg border-2 border-blue-500 bg-blue-50">
                      <p className="text-xs text-blue-600 font-semibold mb-2">Selected User:</p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={targetUser.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{targetUser.name?.charAt(0) || targetUser.username?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{targetUser.name || targetUser.username}</p>
                          <p className="text-xs text-muted-foreground">@{targetUser.username}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log("Clearing target user");
                            setTargetUser(null);
                            setNewUsername("");
                            setNewAlias("");
                          }}
                          disabled={isAddingContact}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="alias">Alias (Optional)</Label>
                    <Input
                      id="alias"
                      placeholder="Custom name for this contact"
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      disabled={isAddingContact}
                    />
                  </div>

                  {addContactMessage.text && (
                    <div className={`p-3 rounded text-sm ${addContactMessage.type === "error"
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                      }`}>
                      {addContactMessage.text}
                    </div>
                  )}

                  <Button
                    onClick={() => handleAddContact()}
                    disabled={isAddButtonDisabled}
                    className="w-full"
                  >
                    {isAddingContact ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Contact
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-md bg-gray-300">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editingContact && (
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={editingContact.avatar || editingContact.image || "/placeholder.svg"} />
                  <AvatarFallback>
                    {(editingContact.alias || editingContact.name || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">@{editingContact.username || "user"}</p>
                  <p className="text-sm text-muted-foreground">{editingContact.email}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-alias">Alias *</Label>
              <Input
                id="edit-alias"
                value={editAlias}
                onChange={(e) => setEditAlias(e.target.value)}
                placeholder="Enter contact alias"
                disabled={isEditing}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingContact(null)}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isEditing || !editAlias.trim()}
                className="cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
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
          user={{
            id: selectedUser.id,
            fullname: selectedUser.alias || selectedUser.name || "Unknown",
            username: selectedUser.username || selectedUser.name || "user",
            email: selectedUser.email || "",
            avatar: selectedUser.image || selectedUser.avatar || "",
            phone_number: selectedUser.phone_number || "",
            isContact: true,
            isOnline: selectedUser.is_online,
            lastSeen: selectedUser.lastSeen,
            role: selectedUser.role
          }}
          isOwnProfile={false}
        />
      )}
    </>
  )
}