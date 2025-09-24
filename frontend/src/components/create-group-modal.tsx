import { useState, useEffect } from "react"
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
import { apiClient } from "@/lib/api"

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateGroup?: (groupData: { name: string; description?: string; members: number[] }) => Promise<{ id: number; [key: string]: any }> | { id: number; [key: string]: any }
}

interface User {
  id: number
  username: string
  email: string
  full_name?: string
  avatar?: string
  is_online?: boolean
}

export function CreateGroupModal({ isOpen, onClose, onCreateGroup }: CreateGroupModalProps) {
  const [step, setStep] = useState(1)
  const [groupData, setGroupData] = useState({
    name: "",
    description: "",
    avatar: "",
    id: null as number | null,
  })
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isOpen && step === 2) {
      loadAllUsers()
    }
  }, [isOpen, step])

  const loadAllUsers = async () => {
    try {
      setIsSearching(true)
      const users = await apiClient.searchUsers("")
      setAllUsers(users || [])
      setSearchResults(users || [])
    } catch (error) {
      console.error("Failed to load users:", error)
      setAllUsers([])
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleUserToggle = (userId: number) => {
    setSelectedUsers((prev) => 
      prev.includes(userId) 
        ? prev.filter((id) => id !== userId) 
        : [...prev, userId]
    )
  }

  const addMembersToGroup = async (groupId: number, memberIds: number[]) => {
    const addMemberPromises = memberIds.map(userId => 
      apiClient.addGroupMember({
        group: groupId,
        user: userId,
        role: 'member'
      })
    )

    try {
      await Promise.all(addMemberPromises)
      console.log(`Successfully added ${memberIds.length} members to group`)
    } catch (error) {
      console.error("Failed to add some members:", error)
      throw new Error("Failed to add some members to the group")
    }
  }

  // Step 1 da Save tugmasi bosilganda guruh yaratish
  const handleSaveGroup = async () => {
    if (!groupData.name.trim()) {
      alert("Enter group name")
      return
    }

    setIsCreating(true)
    
    try {
      if (onCreateGroup) {
        const result = await onCreateGroup({
          name: groupData.name,
          description: groupData.description,
          members: []
        })

        console.log("Group creation result:", result)
        console.log("Result type:", typeof result)
        console.log("Result keys:", result ? Object.keys(result) : "No keys")

        // Turli xil return formatlarini tekshirish
        let groupId = null
        
        if (result && typeof result === 'object') {
          // Ko'proq mumkin bo'lgan formatlarni tekshiramiz
          groupId = result.id || 
                   result.group_id || 
                   result.groupId || 
                   result.data?.id || 
                   result.data?.group_id ||
                   result.response?.id ||
                   result.result?.id
        } else if (typeof result === 'number') {
          groupId = result
        } else if (typeof result === 'string' && !isNaN(Number(result))) {
          groupId = Number(result)
        }

        if (groupId) {
          setGroupData(prev => ({ ...prev, id: groupId }))
          console.log("Group created with ID:", groupId)
        } else {
          console.warn("No group ID found in result:", result)
          // Foydalanuvchiga aniqroq ma'lumot beramiz
          console.log("Please check your onCreateGroup callback. It should return an object with 'id' property or the ID directly.")
        }
      } else {
        console.warn("onCreateGroup callback not provided")
      }

      // Har qanday holatda ham Step 2 ga o'tamiz
      setStep(2)
      
    } catch (error) {
      console.error("Failed to create group:", error)
      alert("Error while creating group: " + (error))
    } finally {
      setIsCreating(false)
    }
  }

  // Step 2 da Create group tugmasi bosilganda a'zolarni qo'shish
  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      // A'zo tanlanmasa shunchaki modal yopish
      resetModal()
      onClose()
      return
    }

    if (!groupData.id) {
      console.warn("No group ID available for adding members")
      // ID bo'lmasa ham modalini yopamiz
      alert("Group was created but members cannot be added automatically. Please add them manually.")
      resetModal()
      onClose()
      return
    }

    setIsCreating(true)
    
    try {
      await addMembersToGroup(groupData.id, selectedUsers)
      resetModal()
      onClose()
    } catch (error) {
      console.error("Failed to add members:", error)
      alert("Error while adding members to group: " + (error))
      // Xato bo'lsa ham modalini yopamiz
      resetModal()
      onClose()
    } finally {
      setIsCreating(false)
    }
  }

  const resetModal = () => {
    setStep(1)
    setGroupData({ name: "", description: "", avatar: "", id: null })
    setSelectedUsers([])
    setSearchQuery("")
    setSearchResults([])
    setIsCreating(false)
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.trim()) {
      setIsSearching(true)
      try {
        const results = await apiClient.searchUsers(query)
        setSearchResults(results || [])
      } catch (err) {
        console.error("Search error:", err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults(allUsers)
    }
  }

  const removeSelectedUser = (userId: number) => {
    setSelectedUsers(prev => prev.filter(id => id !== userId))
  }

  const getUserName = (user: User): string => {
    return user.full_name || user.username || user.email || "Foydalanuvchi"
  }

  const getAvatarLetter = (name: string): string => {
    if (!name || name === "undefined") return "U"
    return name.charAt(0).toUpperCase()
  }

  const displayUsers = searchQuery.trim() ? searchResults : allUsers

  return (
    <Dialog open={isOpen} onOpenChange={() => {
      // Modal yopilishini to'liq bloklaymiz
      // Faqat bizning tugmalarimiz orqali yopish
    }}>
      <DialogContent className="max-w-md bg-gray-300">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {step === 1 ? "New group" : "A'zolarni tanlash"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Guruh nomi va tavsifini kiriting" 
              : "Guruhga qo'shmoqchi bo'lgan a'zolarni tanlang"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={groupData.name}
                onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
                required
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group-description">Description (optional)</Label>
              <Textarea
                id="group-description"
                placeholder="Description..."
                value={groupData.description}
                onChange={(e) => setGroupData({ ...groupData, description: e.target.value })}
                rows={3}
                disabled={isCreating}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  resetModal()
                  onClose()
                }}
                disabled={isCreating}
                className="cursor-pointer hover:scale-105 transition duration-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveGroup}
                disabled={!groupData.name.trim() || isCreating}
                className="cursor-pointer hover:scale-105 transition duration-300"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 flex flex-col h-full">
            {/* Qidiruv qismi */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
                disabled={isCreating}
              />
            </div>

            {/* Tanlangan a'zolar */}
            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Members to add ({selectedUsers.length})
                </Label>
                <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                  {selectedUsers.map((userId) => {
                    const user = allUsers.find(u => u.id === userId)
                    return user ? (
                      <Badge key={userId} variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800">
                        {getUserName(user)}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-red-600" 
                          onClick={() => !isCreating && removeSelectedUser(userId)} 
                        />
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* Foydalanuvchilar ro'yxati */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-64 border rounded-lg bg-gray-200">
                <div className="space-y-2 p-2">
                  {isSearching ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading...</p>
                    </div>
                  ) : displayUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No users found</p>
                    </div>
                  ) : (
                    displayUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors ${
                          isCreating ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        onClick={() => !isCreating && handleUserToggle(user.id)}
                      >
                        <Checkbox 
                          checked={selectedUsers.includes(user.id)} 
                          onCheckedChange={() => !isCreating && handleUserToggle(user.id)}
                          disabled={isCreating}
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-blue-500 text-white">
                            {getAvatarLetter(getUserName(user))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">
                              {getUserName(user)}
                            </h3>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            @{user.username || user.email.split('@')[0]}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Loading state */}
            {isCreating && (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-gray-600">Adding members to group...</span>
              </div>
            )}

            {/* Tugmalar */}
            <div className="flex justify-between pt-4 border-t">
              <Button 
                className="cursor-pointer hover:scale-105 transition duration-300" 
                variant="outline" 
                onClick={handleBack}
                disabled={isCreating}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button 
                  className="cursor-pointer hover:scale-105 transition duration-300" 
                  variant="outline" 
                  onClick={() => {
                    resetModal()
                    onClose()
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddMembers}
                  disabled={isCreating}
                  className="cursor-pointer hover:scale-105 transition duration-300"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" />
                      {selectedUsers.length > 0 ? `Add members (${selectedUsers.length})` : 'Skip'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}