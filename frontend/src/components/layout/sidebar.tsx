import axios from "axios";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, MessageCircle, FileText, LogOut, Shield, Users, UserPlus } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fetchWithAuth } from "@/utils/auth";

interface UserInterface {
  fullname: string;
  username: string;
  image: string;
}

export function Sidebar() {
  const [user, setUser] = useState<UserInterface | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [, setIsLoading] = useState(true)

  const [profileData, setProfileData] = useState({
    fullname: "",
    username: "",
    image: "",
  })

  useEffect(() => {
    fetchUserData()
  }, [])

  const location = useLocation();
  const navigate = useNavigate();

  const fetchUserData = async () => {
    try {
      const response = await fetchWithAuth("https://planshet2.stat.uz/api/api/v1/accounts/user");
      setUser(response.data);
      setProfileData({
        fullname: response.data.fullname,
        username: response.data.username,
        image: response.data.profile?.image || "",
      });
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      alert("Failed to load user data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/login");
  };

  const handleAddContact = async () => {
    try {
      const token = localStorage.getItem("access_token");

      const userResponse = await axios.get(
        `https://planshet2.stat.uz/api/api/v1/accounts/filter/?search=${newUsername}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (userResponse.data.length === 0) {
        alert("User not found");
        return;
      }

      const userId = userResponse.data[0].id;

      await axios.post(
        "https://planshet2.stat.uz/api/api/v1/accounts/contact/",
        { contact_user: userId, alias: newAlias },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowModal(false);
      setNewAlias("");
      setNewUsername("");
    } catch (error) {
      console.error("Failed to add contact:", error);
    }
  };

  const baseNavItems = [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/chat", icon: MessageCircle, label: "Messages" },
    { href: "/files", icon: FileText, label: "Files" },
    { href: "/profile", icon: LogOut, label: "Profile" },
  ];

  const navItems =
    user?.fullname === "juraevdevpy@gmail.com"
      ? [{ href: "/users", icon: Users, label: "Users" }, ...baseNavItems]
      : baseNavItems;

  return (
    <div className="w-64 bg-black border-r border-slate-200 h-screen flex flex-col">
      <div className="p-6 border-b border-slate-200 flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-slate-800">SecureComm</h1>
          <p className="text-xs text-slate-500">Internal Platform</p>
        </div>
      </div>

      {user && (
        <div className="p-4 border-b border-slate-200 flex items-center space-x-3">
          <Avatar className="w-12 h-12">
            {profileData.image ? (
              <img
                src={profileData.image}
                alt={profileData.fullname}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {profileData.fullname.charAt(0)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
            <p className="text-xs text-slate-500">{user.fullname}</p>
          </div>
        </div>
      )}

      <nav className="p-4 border-b border-slate-200">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <button
                  onClick={() => navigate(item.href)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm w-full ${isActive
                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4">
        <Button
          onClick={() => setShowModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <div className="flex-1"></div>

      <div className="p-4 border-t border-slate-200">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-4 text-slate-800">Add Contact</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Username
                </label>
                <Input
                  type="text"
                  placeholder="Enter username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Alias (optional)
                </label>
                <Input
                  type="text"
                  placeholder="Enter alias"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddContact}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add Contact
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}