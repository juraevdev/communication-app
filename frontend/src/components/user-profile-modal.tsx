import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Edit, Save, X, Eye, EyeOff } from "lucide-react"
import { apiClient } from "@/lib/api"

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    id: number
    fullname?: string
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
  onProfileUpdate?: (updatedUser: any) => void
}

export function UserProfileModal({
  isOpen,
  onClose,
  user,
  isOwnProfile = false,
  onProfileUpdate,
}: UserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    fullname: user.fullname,
    username: user.username,
    email: user.email,
    phone_number: user.phone_number,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" })

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
  const [currentUserPhone, setCurrentUserPhone] = useState(user.phone_number)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('[data-form-type="password"]');
        inputs.forEach(input => {
          if (input instanceof HTMLInputElement) {
            input.value = '';
            input.autocomplete = 'new-password';
          }
        });

        const searchInput = document.getElementById('chat-search-users-input');
        if (searchInput instanceof HTMLInputElement) {
          const currentValue = searchInput.value;
          if (currentValue && (currentValue.includes('@') || currentValue.length > 20)) {
            searchInput.value = '';
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
          }
        }
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setEditData({
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
      })
      setCurrentUserPhone(user.phone_number)
    }
  }, [isOpen, user])

  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!isOwnProfile || !isOpen || !isEditing) return;
    }

    fetchCurrentUserProfile()
  }, [isOpen, isOwnProfile, isEditing])

  const handleSave = async () => {
  if (!editData.fullname?.trim()) {
    setSaveMessage({ type: "error", text: "Name is required" });
    return;
  }

  if (!editData.username.trim()) {
    setSaveMessage({ type: "error", text: "Username is required" });
    return;
  }

  setIsSaving(true);
  setSaveMessage({ type: "", text: "" });

  try {
    const updatedUser = await apiClient.updateUserProfile({
      fullname: editData.fullname,
      username: editData.username,
      phone_number: editData.phone_number,
      email: editData.email,
    });

    console.log("✅ Profile updated:", updatedUser);

    // ✅ 1. Parent component ni yangilash
    if (onProfileUpdate) {
      onProfileUpdate(updatedUser);
    }

    // ✅ 2. Local state larni yangilash
    setEditData({
      fullname: updatedUser.fullname,
      username: updatedUser.username,
      email: updatedUser.email,
      phone_number: updatedUser.phone_number,
    });
    
    setCurrentUserPhone(updatedUser.phone_number);

    // ✅ 3. localStorage ni yangilash (agar kerak bo'lsa)
    if (isOwnProfile) {
      const currentUserData = localStorage.getItem('user_data');
      if (currentUserData) {
        const parsedData = JSON.parse(currentUserData);
        const updatedUserData = { ...parsedData, ...updatedUser };
        localStorage.setItem('user_data', JSON.stringify(updatedUserData));
        console.log("✅ localStorage updated with new profile data");
      }
    }

    setSaveMessage({ type: "success", text: "Profile updated successfully" });
    setIsEditing(false);

  } catch (error: any) {
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      "Failed to update profile";
    setSaveMessage({ type: "error", text: errorMessage });
    console.error("❌ Profile update error:", error);
  } finally {
    setIsSaving(false);
  }
};

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      setIsEditing(false)
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      })
      setPasswordMessage({ type: "", text: "" })
      setSaveMessage({ type: "", text: "" })
      setEditData({
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
      })
      setCurrentUserPhone(user.phone_number)
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
            {isEditing ? (
              <div className="w-full space-y-3">
                <div>
                  <Label htmlFor="user-profile-edit-name">Full Name *</Label>
                  <Input
                    id="user-profile-edit-name"
                    value={editData.fullname}
                    onChange={(e) => handleEditChange("fullname", e.target.value)}
                    disabled={isSaving}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <Label htmlFor="user-profile-edit-username">Username *</Label>
                  <Input
                    id="user-profile-edit-username"
                    value={editData.username}
                    onChange={(e) => handleEditChange("username", e.target.value)}
                    placeholder="@username"
                    disabled={isSaving}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <Label htmlFor="user-profile-edit-email">Email *</Label>
                  <Input
                    id="user-profile-edit-email"
                    value={editData.email}
                    onChange={(e) => handleEditChange("email", e.target.value)}
                    placeholder="@email"
                    disabled={isSaving}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="user-profile-edit-phone">Phone Number</Label>
                  <Input
                    id="user-profile-edit-phone"
                    value={editData.phone_number}
                    onChange={(e) => handleEditChange("phone_number", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    disabled={isSaving}
                    autoComplete="tel"
                  />
                </div>

                {saveMessage.text && (
                  <div className={`p-2 rounded text-sm ${saveMessage.type === "error"
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
                <p className="text-muted-foreground">@{user.fullname}</p>
              </div>
            )}
          </div>

          {!isEditing && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger className="cursor-pointer" value="info">Info</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="settings">Password</TabsTrigger>
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
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm text-muted-foreground">
                      {isOwnProfile ? (currentUserPhone || "Not provided") : (user.phone_number || "Not provided")}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                {isOwnProfile ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="user-profile-current-password">Current Password *</Label>
                      <div className="relative">
                        <Input
                          id="user-profile-current-password"
                          name="user-profile-current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordData.current_password}
                          onChange={(e) => handlePasswordChange("current_password", e.target.value)}
                          className="pr-10"
                          placeholder="Enter your current password"
                          disabled={isChangingPassword}
                          autoComplete="new-password"
                          data-form-type="password"
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
                      <Label htmlFor="user-profile-new-password">New Password *</Label>
                      <div className="relative">
                        <Input
                          id="user-profile-new-password"
                          name="user-profile-new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.new_password}
                          onChange={(e) => handlePasswordChange("new_password", e.target.value)}
                          className="pr-10"
                          placeholder="Enter your new password"
                          disabled={isChangingPassword}
                          autoComplete="new-password"
                          data-form-type="password"
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
                      <Label htmlFor="user-profile-confirm-password">Confirm New Password *</Label>
                      <div className="relative">
                        <Input
                          id="user-profile-confirm-password"
                          name="user-profile-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordData.confirm_password}
                          onChange={(e) => handlePasswordChange("confirm_password", e.target.value)}
                          className="pr-10"
                          placeholder="Confirm your new password"
                          disabled={isChangingPassword}
                          autoComplete="new-password"
                          data-form-type="password"
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
                      <div className={`p-3 rounded text-sm ${passwordMessage.type === "error"
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