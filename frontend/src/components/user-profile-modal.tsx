import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Edit, Save, X, Eye, EyeOff } from "lucide-react"
import { apiClient } from "@/lib/api"

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: number
    name: string
    username: string
    email: string
    avatar: string
    phone_number: string
    isContact: boolean
    isOnline: boolean
    lastSeen: string
    role?: string
  }
  isOwnProfile?: boolean
}

export function UserProfileModal({ isOpen, onClose, user, isOwnProfile = false }: UserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: user.name,
    username: user.username,
    phone: user.phone_number,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" })

  // Password change states
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" })

  const handleSave = async () => {
    // Validatsiya
    if (!editData.name.trim()) {
      setSaveMessage({ type: "error", text: "Name is required" })
      return
    }

    if (!editData.username.trim()) {
      setSaveMessage({ type: "error", text: "Username is required" })
      return
    }

    setIsSaving(true)
    setSaveMessage({ type: "", text: "" })

    try {
      // User ma'lumotlarini yangilash
      await apiClient.updateUserProfile({
        name: editData.name,
        username: editData.username,
      })

      // Profile ma'lumotlarini yangilash (telefon raqam)
      await apiClient.updateProfile({
        phone_number: editData.phone,
      })

      setSaveMessage({ type: "success", text: "Profile updated successfully" })
      setIsEditing(false)
      
      // Ma'lumotlarni yangilash uchun parent componentga signal yuborish kerak bo'lsa
      // onProfileUpdate?.() 
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to update profile"
      setSaveMessage({ type: "error", text: errorMessage })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      // Reset states when closing
      setIsEditing(false)
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      })
      setPasswordMessage({ type: "", text: "" })
      setSaveMessage({ type: "", text: "" })
    }
  }

  const changePassword = async () => {
    if (!passwordData.current_password) {
      setPasswordMessage({ type: "error", text: "Current password is required" })
      return
    }

    if (!passwordData.new_password) {
      setPasswordMessage({ type: "error", text: "New password is required" })
      return
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" })
      return
    }

    if (passwordData.new_password.length < 6) {
      setPasswordMessage({ type: "error", text: "Password must be at least 6 characters long" })
      return
    }

    setIsChangingPassword(true)
    setPasswordMessage({ type: "", text: "" })

    try {
      const response = await apiClient.changePassword({
        password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password
      })

      setPasswordMessage({ 
        type: "success", 
        text: response.message || "Password changed successfully" 
      })
      
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          "Failed to change password"
      setPasswordMessage({ type: "error", text: errorMessage })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }))
    if (passwordMessage.text) {
      setPasswordMessage({ type: "", text: "" })
    }
  }

  const handleEditChange = (field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }))
    if (saveMessage.text) {
      setSaveMessage({ type: "", text: "" })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-gray-300">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isOwnProfile ? "My Profile" : "User Profile"}</DialogTitle>
            {isOwnProfile && !isEditing && (
              <Button className="cursor-pointer" variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {isOwnProfile && isEditing && (
              <Button className="cursor-pointer" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user.avatar || "/placeholder.svg"} />
                <AvatarFallback className="text-lg">{user.name}</AvatarFallback>
              </Avatar>
            </div>

            {isEditing ? (
              <div className="w-full space-y-3">
                <div>
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    value={editData.name}
                    onChange={(e) => handleEditChange("name", e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-username">Username *</Label>
                  <Input
                    id="edit-username"
                    value={editData.username}
                    onChange={(e) => handleEditChange("username", e.target.value)}
                    placeholder="@username"
                    disabled={isSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editData.phone}
                    onChange={(e) => handleEditChange("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    disabled={isSaving}
                  />
                </div>

                {saveMessage.text && (
                  <div className={`p-2 rounded text-sm ${
                    saveMessage.type === "error" 
                      ? "bg-red-100 text-red-700 border border-red-200" 
                      : "bg-green-100 text-green-700 border border-green-200"
                  }`}>
                    {saveMessage.text}
                  </div>
                )}

                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full cursor-pointer hover:scale-105 transition duration-300"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-2">
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-muted-foreground">@{user.username}</p>
                {user.phone_number && (
                  <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                )}
              </div>
            )}
          </div>

          {!isEditing && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="cursor-pointer" value="info">Info</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Username</Label>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                  {user.phone_number && (
                    <div>
                      <Label className="text-sm font-medium">Phone</Label>
                      <p className="text-sm text-muted-foreground">{user.phone_number}</p>
                    </div>
                  )}
                  {user.role && (
                    <div>
                      <Label className="text-sm font-medium">Role</Label>
                      <p className="text-sm text-muted-foreground">{user.role}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {user.isOnline ? "Online" : `Last seen ${new Date(user.lastSeen).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                {isOwnProfile ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="current_password">Current Password *</Label>
                      <div className="relative">
                        <Input
                          id="current_password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordData.current_password}
                          onChange={(e) => handlePasswordChange("current_password", e.target.value)}
                          className="pr-10"
                          placeholder="Enter your current password"
                          disabled={isChangingPassword}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          disabled={isChangingPassword}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password">New Password *</Label>
                      <div className="relative">
                        <Input
                          id="new_password"
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.new_password}
                          onChange={(e) => handlePasswordChange("new_password", e.target.value)}
                          className="pr-10"
                          placeholder="Enter your new password"
                          disabled={isChangingPassword}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          disabled={isChangingPassword}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm New Password *</Label>
                      <div className="relative">
                        <Input
                          id="confirm_password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordData.confirm_password}
                          onChange={(e) => handlePasswordChange("confirm_password", e.target.value)}
                          className="pr-10"
                          placeholder="Confirm your new password"
                          disabled={isChangingPassword}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={isChangingPassword}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {passwordMessage.text && (
                      <div className={`p-3 rounded text-sm ${
                        passwordMessage.type === "error" 
                          ? "bg-red-100 text-red-700 border border-red-200" 
                          : "bg-green-100 text-green-700 border border-green-200"
                      }`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <Button 
                      onClick={changePassword}
                      disabled={isChangingPassword || !passwordData.current_password || !passwordData.new_password}
                      className="w-full cursor-pointer hover:scale-105 transition duration-300"
                    >
                      {isChangingPassword ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Changing Password...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    Settings are only available for your own profile
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}