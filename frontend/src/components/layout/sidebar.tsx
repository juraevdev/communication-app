import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Home, MessageCircle, FileText, LogOut, Shield, Users, UserPlus, User } from "lucide-react";
import axios from "axios";

interface UserInterface {
  email: string;
  role: "Admin" | "Employee" | string;
  name: string;
  id?: number;
}

interface Contact {
  id: number;
  name: string;
  username: string;
  avatar?: string;
}

export function Sidebar() {
  const [user, setUser] = useState<UserInterface | null>(null);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user");
      if (userData && userData !== "undefined") {
        setUser(JSON.parse(userData));
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to parse user data:", error);
      setUser(null);
    }

    // Load contacts from localStorage
    const savedContacts = localStorage.getItem("contacts");
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    } else {
      // Initialize with some default contacts only if none exist
      const defaultContacts = [
        { id: 1, name: "John Smith", username: "john.smith" },
        { id: 2, name: "Sarah Johnson", username: "sarah.johnson" },
        { id: 3, name: "Mike Davis", username: "mike.davis" },
      ];
      setContacts(defaultContacts);
      localStorage.setItem("contacts", JSON.stringify(defaultContacts));
    }

    // Listen for contacts updates
    const handleContactsUpdate = () => {
      const updated = JSON.parse(localStorage.getItem("contacts") || "[]");
      setContacts(updated);
    }

    window.addEventListener("contactsUpdated", handleContactsUpdate);
    return () => window.removeEventListener("contactsUpdated", handleContactsUpdate);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleContactClick = (contact: Contact) => {
    // Navigate to chat with this contact
    navigate(`/chat?contact=${contact.username}`);
  };

  const baseNavItems = [
    { href: "/", icon: Home, label: "Dashboard" },
    { href: "/chat", icon: MessageCircle, label: "Messages" },
    { href: "/files", icon: FileText, label: "Files" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  const navItems = user?.role === "Admin"
    ? [{ href: "/users", icon: Users, label: "Users" }, ...baseNavItems]
    : baseNavItems;

  // Contacts Modal Component - now defined inside the Sidebar component
  const ContactsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("access_token");
        
        if (!token) {
          throw new Error("Siz tizimga kirmagansiz. Iltimos, avval tizimga kiring.");
        }

        // Avval foydalanuvchini username orqali topish
        const userSearchResponse = await axios.get(`http://127.0.0.1:8000/api/v1/accounts/filter/?search=${username}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // TO'G'RI: data property sifatida olish
        const userSearchData = userSearchResponse.data;
        
        // Results mavjudligini tekshirish
        if (!userSearchData || !userSearchData.results || userSearchData.results.length === 0) {
          throw new Error("Bunday foydalanuvchi nomi topilmadi");
        }

        const targetUser = userSearchData.results[0];
        
        // Endi kontakt qo'shish
        const response = await fetch("http://127.0.0.1:8000/api/v1/accounts/contact/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            alias: name,
            contact_user: targetUser.id
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || errorData.message || "Kontakt qo'shishda xatolik yuz berdi");
        }

        const newContact = await response.json();
        
        // Update local storage with the new contact
        const existingContacts = JSON.parse(localStorage.getItem("contacts") || "[]");
        const updatedContacts = [...existingContacts, {
          id: newContact.id || newContact.contact?.id || Date.now(),
          name: name,
          username: username
        }];
        localStorage.setItem("contacts", JSON.stringify(updatedContacts));
        
        // Trigger custom event to notify other components
        window.dispatchEvent(new CustomEvent("contactsUpdated"));
        
        // Reset form and close modal
        setName("");
        setUsername("");
        onClose();
        
      } catch (err) {
        console.error("Xatolik detalari:", err);
        setError(err instanceof Error ? err.message : "Noma'lum xatolik");
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Yangi Kontakt Qo'shish
            </DialogTitle>
            <DialogDescription>
              Yangi kontakt qo'shish uchun quyidagi maydonlarni to'ldiring
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Kontakt Nomi (Alias)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kontaktning nomi"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Foydalanuvchi nomi</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Foydalanuvchi nomi"
                required
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded-md">
                {error}
              </div>
            )}
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={onClose}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Qo'shilyapti..." : "Qo'shish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">SecureComm</h1>
            <p className="text-xs text-slate-500">Internal Platform</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-4 border-b border-slate-200">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <button
                  onClick={() => navigate(item.href)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors w-full ${isActive
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

      {/* Contacts Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-700">Contacts</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowContactsModal(true)}
              className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowContactsModal(true)}
            className="w-full justify-start text-slate-600 hover:text-slate-800 bg-transparent"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add New Contact
          </Button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 px-4 overflow-y-auto">
          <div className="space-y-1">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                    {contact.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{contact.name}</p>
                  <p className="text-xs text-slate-500">@{contact.username}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logout */}
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

      {/* Contacts Modal */}
      <ContactsModal isOpen={showContactsModal} onClose={() => setShowContactsModal(false)} />
    </div>
  );
}