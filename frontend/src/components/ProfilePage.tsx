import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Lock, Shield, Camera, Save, Eye, EyeOff } from "lucide-react"
import axios from "axios"
import { MainLayout } from "./layout/main-layout"

interface UserProfile {
  id: number
  fullname: string
  email: string
  username: string
  is_online: boolean
  last_seen: string
  date_joined?: string
  profile?: {
    phone_number: string
    image: string
    id: number
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const [profileData, setProfileData] = useState({
    fullname: "",
    email: "",
    username: "",
    phone_number: "",
    password: "",
    new_password: "",
    confirm_password: "",
  })

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("access_token")
      const response = await axios.get("https://hisobot2.stat.uz/api/v1/accounts/user", {
        headers: { Authorization: `Bearer ${token}` },
      })

      setUser(response.data)
      setProfileData({
        fullname: response.data.fullname,
        email: response.data.email,
        username: response.data.username,
        phone_number: response.data.profile?.phone_number || "",
        password: "",
        new_password: "",
        confirm_password: "",
      })
    } catch (error) {
      console.error("Failed to fetch user data:", error)
      alert("Failed to load user data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem("access_token")

      await axios.patch(
        `https://hisobot2.stat.uz/api/v1/accounts/user/`,
        {
          fullname: profileData.fullname,
          email: profileData.email,
          username: profileData.username,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (user?.profile) {
        await axios.patch(
          `https://hisobot2.stat.uz/api/v1/accounts/profile/`,
          {
            phone_number: profileData.phone_number,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }

      setIsEditing(false)
      fetchUserData() 
    } catch (error) {
      console.error("Failed to update profile:", error)
      alert("Failed to update profile")
    }
  }

  const handleChangePassword = async () => {
    if (profileData.new_password !== profileData.confirm_password) {
      alert("Yangi parollar mos kelmadi");
      return;
    }

    if (profileData.new_password.length < 6) {
      alert("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }

    try {
      const token = localStorage.getItem("access_token");

      await axios.post(
        "https://hisobot2.stat.uz/api/v1/accounts/change-password/",
        {
          password: profileData.password,
          new_password: profileData.new_password,
          confirm_password: profileData.confirm_password,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProfileData((prev) => ({
        ...prev,
        password: "",
        new_password: "",
        confirm_password: "",
      }));
    } catch (error: any) {
      console.error("Parolni o'zgartirishda xatolik:", error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }))
  }

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return

    const file = e.target.files[0]
    const formData = new FormData()
    formData.append("image", file)

    try {
      const token = localStorage.getItem("access_token")

      if (user?.profile) {
        await axios.patch(
          `https://hisobot2.stat.uz/api/v1/accounts/profile/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data"
            }
          }
        )
      } else {
        await axios.post(
          "https://hisobot2.stat.uz/api/v1/accounts/profile/",
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data"
            }
          }
        )
      }

      setImageError(false)
      fetchUserData() 
      alert("Profile image updated successfully!")
    } catch (error) {
      console.error("Failed to update profile image:", error)
      alert("Failed to update profile image")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Profile Settings</h1>
          <p className="text-slate-600 mt-1">Manage your account information and security settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-slate-200">
            <CardHeader className="text-center">
              <div className="relative mx-auto">
                <Avatar className="w-24 h-24 mx-auto">
                  {user?.profile?.image && !imageError ? (
                    <AvatarImage 
                      src={user.profile.image} 
                      alt={user.fullname}
                      onError={() => setImageError(true)}
                    />
                  ) : null}
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl">
                    {user?.fullname?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label htmlFor="profile-image" className="cursor-pointer">
                  <div className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 bg-white hover:bg-gray-50 border border-slate-200 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <input
                    id="profile-image"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfileImageChange}
                  />
                </label>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-800">{user?.fullname}</h3>
                <p className="text-sm text-slate-600">{user?.email}</p>
                <p className="text-xs text-slate-500">@{user?.username}</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-medium">{user?.profile?.phone_number || "Not set"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullname">Full Name</Label>
                    <Input
                      id="fullname"
                      value={profileData.fullname}
                      onChange={(e) => handleInputChange("fullname", e.target.value)}
                      disabled={!isEditing}
                      className="disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      disabled={!isEditing}
                      className="disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={profileData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      disabled={!isEditing}
                      className="disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={profileData.phone_number}
                      onChange={(e) => handleInputChange("phone_number", e.target.value)}
                      disabled={!isEditing}
                      className="disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="+998901234567"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700">
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your password and security preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={profileData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="new_password"
                        type={showNewPassword ? "text" : "password"}
                        value={profileData.new_password}
                        onChange={(e) => handleInputChange("new_password", e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="Enter new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="confirm_password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={profileData.confirm_password}
                        onChange={(e) => handleInputChange("confirm_password", e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="Confirm new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />

                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-slate-800">Two-Factor Authentication</h4>
                    <p className="text-sm text-slate-600">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Enable 2FA
                  </Button>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    onClick={handleChangePassword}
                    disabled={!profileData.password || !profileData.new_password || !profileData.confirm_password}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </MainLayout>
  )
}