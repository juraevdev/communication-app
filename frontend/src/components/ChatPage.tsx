import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import MessageBubble from "./MessageBubble";
import {
  Send,
  Paperclip,
  Search,
  MoreVertical,
  FileText,
  ImageIcon,
  X,
  File,
  Video,
  Music,
} from "lucide-react";

interface Message {
  id: number;
  sender: string;
  content: string;
  timestampISO?: string;
  timestamp: string;
  isOwn: boolean;
  type: "text" | "file";
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  fileSize?: number;
  isRead?: boolean;
  isUpdated?: boolean;
}

interface Contact {
  id: number;
  name: string;
  image: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  isOnline?: boolean;
  lastSeen?: string;
  isContact?: boolean;
}

interface StatusUpdate {
  type: "status_update";
  user_id: number;
  status: "online" | "offline";
  timestamp: string;
}

interface FileUploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  progress: number;
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<number, { isOnline: boolean; lastSeen?: string }>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [, setStatusWs] = useState<WebSocket | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [allUsers, setAllUsers] = useState<Contact[]>([]);
  const [fileUpload, setFileUpload] = useState<FileUploadState>({
    file: null,
    preview: null,
    uploading: false,
    progress: 0
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser || storedUser === "undefined" || storedUser === "null") return "";
      const parsedUser = JSON.parse(storedUser);
      return (
        parsedUser.fullname ||
        parsedUser.username ||
        parsedUser.name ||
        parsedUser.email ||
        ""
      );
    } catch {
      return "";
    }
  };
  const currentUser = useMemo(getCurrentUser, []);

  const handleStatusUpdate = useCallback((data: StatusUpdate) => {
    console.log("📡 Status update:", data);

    const newStatus = {
      isOnline: data.status === "online",
      lastSeen: data.status === "offline" ? data.timestamp : undefined
    };

    setUserStatuses(prev => {
      const updated = new Map(prev);
      updated.set(data.user_id, newStatus);
      return updated;
    });
  }, []);


  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    console.log("🔌 Connecting to status WebSocket...");
    const statusSocket = new WebSocket(`ws://127.0.0.1:8000/ws/status/?token=${token}`);

    statusSocket.onopen = () => {
      console.log("✅ Status WebSocket connected - READY FOR REAL-TIME");
    };

    statusSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "status_update") {
          handleStatusUpdate(data);
        }
      } catch (error) {
        console.error("Status parse error:", error);
      }
    };

    statusSocket.onclose = () => {
      console.log("❌ Status WebSocket disconnected");
      setTimeout(() => {
        console.log("🔄 Attempting to reconnect status WebSocket...");
      }, 3000);
    };

    statusSocket.onerror = (error) => {
      console.error("Status WebSocket error:", error);
    };

    setStatusWs(statusSocket);

    return () => {
      console.log("🔌 Closing status WebSocket");
      statusSocket.close();
    };
  }, [handleStatusUpdate]);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:8000/api/v1/accounts/contact/filter/",
          {
            params: { search: searchTerm },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );

        const data: Contact[] = response.data.map((contact: any) => {
          const actualUserId = contact.contact_user?.id || contact.contact_user;
          const liveStatus = userStatuses.get(actualUserId);

          return {
            id: actualUserId,
            name: contact.alias || contact.contact_user?.fullname || contact.contact_user?.username || contact.contact_user?.email,
            image: contact.image,
            lastMessage: contact.last_message || "",
            timestamp: contact.last_message_timestamp || "",
            unread: contact.unread_count || 0,
            isOnline: liveStatus ? liveStatus.isOnline : (contact.contact_user?.is_online || false),
            lastSeen: liveStatus ? liveStatus.lastSeen : (contact.contact_user?.last_seen || ""),
          };
        });

        data.sort((a, b) => {
          if (a.unread > 0 && b.unread === 0) return -1;
          if (a.unread === 0 && b.unread > 0) return 1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        setContacts(data);
        console.log("📋 Contacts loaded with real-time status");
      } catch (error) {
        console.error("Error fetching contacts", error);
      }
    };

    const fetchAllUsers = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:8000/api/v1/accounts/users/search/",
          {
            params: { search: searchTerm },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );

        const data: Contact[] = response.data.map((user: any) => {
          const liveStatus = userStatuses.get(user.id);

          const imageUrl = user.image
            ? `http://127.0.0.1:8000${user.image}`
            : "";

          const userName = user.username || user.full_name || user.email;

          return {
            id: user.id,
            name: userName,
            image: imageUrl,
            lastMessage: user.last_message || "",            
            timestamp: user.last_message_timestamp || "",       
            unread: user.unread_count || 0,                   
            isOnline: liveStatus ? liveStatus.isOnline : (user.is_online || false),
            lastSeen: liveStatus ? liveStatus.lastSeen : (user.last_seen || ""),
            isContact: false
          };
        });

        setAllUsers(data);
      } catch (error) {
        console.error("Error fetching non-contact users", error);
      }
    };


    if (showAllUsers) {
      fetchAllUsers();
    } else {
      fetchContacts();
    }
  }, [searchTerm, userStatuses, showAllUsers]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    console.log("🔔 Connecting to notifications WebSocket...");
    const notifSocket = new WebSocket(`ws://127.0.0.1:8000/ws/notifications/?token=${token}`);

    notifSocket.onopen = () => {
      console.log("✅ Notifications WebSocket connected");
    };

    notifSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "unread_count_update") {
          console.log("🔔 Unread update:", data);

          setContacts(prev =>
            prev.map(c =>
              c.id === data.contact_id ? { ...c, unread: data.unread_count } : c
            )
          );

          setAllUsers(prev =>
            prev.map(u =>
              u.id === data.contact_id ? { ...u, unread: data.unread_count } : u
            )
          );

          if (selectedContact && selectedContact.id === data.contact_id) {
            setSelectedContact(prev =>
              prev ? { ...prev, unread: data.unread_count } : prev
            );
          }
        }
      } catch (err) {
        console.error("Notif parse error:", err);
      }
    };

    notifSocket.onclose = () => {
      console.log("❌ Notifications WebSocket disconnected");
      setTimeout(() => {
        console.log("🔄 Reconnecting notifications WebSocket...");
      }, 3000);
    };

    notifSocket.onerror = (err) => {
      console.error("Notifications WebSocket error:", err);
    };

    return () => {
      console.log("🔌 Closing notifications WebSocket");
      notifSocket.close();
    };
  }, [selectedContact]);

  useEffect(() => {
    if (selectedContact) {
      const liveStatus = userStatuses.get(selectedContact.id);
      if (liveStatus) {
        setSelectedContact(prev => prev ? {
          ...prev,
          isOnline: liveStatus.isOnline,
          lastSeen: liveStatus.lastSeen || prev.lastSeen
        } : null);
      }
    }
  }, [userStatuses, selectedContact?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const token = localStorage.getItem("access_token");
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/room/${roomId}/?token=${token}`);

    socket.onopen = () => {
      console.log("✅ Connected to room:", roomId);
      console.log("👤 Current user:", currentUser);
    };


    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📩 Message from server:", data);

        if (data.type === "unread_count_update") {
          setContacts(prev =>
            prev.map(contact =>
              contact.id === data.contact_id
                ? { ...contact, unread: data.unread_count }
                : contact
            )
          );

          setAllUsers(prev =>
            prev.map(user =>
              user.id === data.contact_id
                ? { ...user, unread: data.unread_count }
                : user
            )
          );

          if (selectedContact && selectedContact.id === data.contact_id) {
            setSelectedContact(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                unread: data.unread_count
              };
            });
          }
        }

        if (data.type === "new_message") {
          setMessages((prev) => {
            const messageExists = prev.some(msg => msg.id === parseInt(data.id));
            if (messageExists) return prev;

            const senderName = data.sender.fullname || data.sender.full_name || "";
            const isOwnMessage = senderName === currentUser;
            const iso = data.timestamp;
            const displayTime = iso ? new Date(iso).toLocaleTimeString() : new Date().toLocaleTimeString();

            return [
              ...prev,
              {
                id: parseInt(data.id),
                sender: senderName,
                content: data.message,
                timestampISO: iso,
                timestamp: displayTime,
                isOwn: isOwnMessage,
                type: "text",
                isRead: data.is_read || false,
                isUpdated: data.is_updated || false,
              },
            ];
          });
        }

        if (data.type === "message_updated") {
          console.log("✏️ Message updated:", data);
          setMessages(prev => prev.map(msg =>
            msg.id === parseInt(data.message_id)
              ? {
                ...msg,
                content: data.new_content,
                isUpdated: true,
              }
              : msg
          ));
          return;
        }

        if (data.type === "file_uploaded") {
          setMessages((prev) => {
            const senderName = data.user?.full_name || "";
            const isOwnMessage = senderName === currentUser;
            return [
              ...prev,
              {
                id: parseInt(data.id),
                sender: senderName,
                content: data.file_name,
                timestampISO: data.uploaded_at,
                timestamp: new Date(data.uploaded_at).toLocaleTimeString(),
                isOwn: isOwnMessage,
                type: "file",
                fileName: data.file_name,
                fileUrl: data.file_url,
                fileType: getFileTypeFromName(data.file_name),
                isRead: false,
                isUpdated: false,
              },
            ];
          });
          setFileUpload({
            file: null,
            preview: null,
            uploading: false,
            progress: 0
          });
        }

        if (data.type === "message_history") {
          const history = data.messages.map((msg: any) => {
            const iso = msg.timestamp;
            const senderName = msg.sender.fullname || msg.sender.full_name || "";
            const isOwnMessage = senderName === currentUser;

            if (msg.type === "file") {
              return {
                id: parseInt(msg.id),
                sender: msg.sender.fullname || msg.sender.full_name || "",
                content: msg.file_name || msg.message,
                timestampISO: iso,
                timestamp: iso ? new Date(iso).toLocaleTimeString() : new Date().toLocaleTimeString(),
                isOwn: isOwnMessage,
                type: "file",
                fileName: msg.file_name,
                fileUrl: msg.file_url,
                fileType: getFileTypeFromName(msg.file_name || msg.message),
                isRead: msg.is_read || false,
                isUpdated: msg.is_updated || false,
              };
            }

            return {
              id: parseInt(msg.id),
              sender: msg.sender.fullname || msg.sender.full_name || "",
              content: msg.message,
              timestampISO: iso,
              timestamp: iso ? new Date(iso).toLocaleTimeString() : new Date().toLocaleTimeString(),
              isOwn: isOwnMessage,
              type: "text",
              isRead: msg.is_read || false,
              isUpdated: msg.is_updated || false,
            };
          });
          setMessages(history.reverse());
        }

        if (data.type === "read") {
          setMessages(prev => prev.map(msg => {
            if (data.message_id && msg.id === parseInt(data.message_id)) {
              return { ...msg, isRead: true };
            }
            if (data.file_id && msg.id === parseInt(data.file_id)) {
              return { ...msg, isRead: true };
            }
            return msg;
          }));

          if (!data.success) {
            console.error("Failed to mark message as read on server");
          }
        }

        // Message deleted
        if (data.type === "message_deleted") {
          setMessages(prev => prev.filter(msg => msg.id !== parseInt(data.message_id)));
        }

        // File deleted
        if (data.type === "file_deleted") {
          setMessages(prev => prev.filter(msg => msg.id !== parseInt(data.file_id)));
        }

        // Success response
        if (data.type === "success") {
          console.log("Server response:", data.message);
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    socket.onclose = () => console.log("❌ Disconnected from room:", roomId);
    setWs(socket);
    return () => socket.close();
  }, [roomId, currentUser, selectedContact]); // ✅ selectedContact dependency qo'shildi

  const startChat = async (contact: Contact) => {
    setSelectedContact(contact);
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/v1/chat/start/",
        { contact_user: contact.id, alias: contact.name },
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
      );
      setRoomId(response.data.room_id);
      setMessages([]);

      if (!contact.isContact) {
        setAllUsers(prev =>
          prev.map(user =>
            user.id === contact.id
              ? { ...user, unread: 0 }
              : user
          )
        );
      }
    } catch (error) {
      console.error("Error starting chat", error);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && ws) {
      ws.send(JSON.stringify({ action: "send", message }));
      setMessage("");
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    messages.forEach(msg => {
      const iso = (msg as any).timestampISO || (msg.timestamp ? msg.timestamp : null);
      const dateObj = iso ? new Date(iso) : new Date(NaN);
      const dateKey = isNaN(dateObj.getTime())
        ? 'unknown'
        : dateObj.toISOString().split('T')[0];

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });

    const entries = Object.entries(groups).sort((a, b) => {
      if (a[0] === 'unknown') return 1;
      if (b[0] === 'unknown') return -1;
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });

    return entries;
  }, [messages]);

  const formatChatDate = (isoDateStr: string) => {
    if (!isoDateStr || isoDateStr === 'unknown') return '';
    const [y, m, d] = isoDateStr.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d);

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      });
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    let preview = null;
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setFileUpload({
      file,
      preview,
      uploading: false,
      progress: 0
    });
  };

  const handleEditMessage = (messageId: number, newContent: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: "edit_message",
        message_id: messageId,
        new_content: newContent
      }));
    }
  };

  // Xabarni o'chirish funksiyasi
  const handleDeleteMessage = (messageId: number, isFile = false) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (isFile) {
        ws.send(JSON.stringify({
          action: "delete_file",
          file_id: messageId,
        }));
      } else {
        ws.send(JSON.stringify({
          action: "delete_message",
          message_id: messageId,
        }));
      }
    }
  };

  const handleFileUpload = async () => {
    if (!fileUpload.file || !ws) return;

    setFileUpload(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;

        ws.send(JSON.stringify({
          action: "upload_file",
          file_data: base64Data,
          file_name: fileUpload.file!.name,
          file_type: fileUpload.file!.type
        }));

        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setFileUpload(prev => ({ ...prev, progress }));
          if (progress >= 100) {
            clearInterval(interval);
          }
        }, 200);
      };

      reader.readAsDataURL(fileUpload.file);
    } catch (error) {
      console.error("Error uploading file:", error);
      setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
    }
  };

  const markMessageAsRead = useCallback((messageId: number, isFile: boolean = false) => {
    if (ws) {
      const payload = isFile
        ? { action: "read", file_id: messageId }
        : { action: "read", message_id: messageId };

      ws.send(JSON.stringify(payload));

      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, isRead: true } : msg
      ));

      if (selectedContact && selectedContact.unread > 0) {
        const newUnreadCount = Math.max(0, selectedContact.unread - 1);

        setSelectedContact(prev => prev ? { ...prev, unread: newUnreadCount } : null);

        setContacts(prev =>
          prev.map(c =>
            c.id === selectedContact.id
              ? { ...c, unread: newUnreadCount }
              : c
          )
        );

        setAllUsers(prev =>
          prev.map(user =>
            user.id === selectedContact.id
              ? { ...user, unread: newUnreadCount }
              : user
          )
        );
      }
    }
  }, [ws, selectedContact]);

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(fileUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Yuklab olishda xatolik:', error);
      alert('Faylni yuklab olish mumkin emas. Iltimos, keyinroq urunib ko\'ring.');
    }
  };

  const handleRemoveFile = () => {
    if (fileUpload.preview) {
      URL.revokeObjectURL(fileUpload.preview);
    }
    setFileUpload({
      file: null,
      preview: null,
      uploading: false,
      progress: 0
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-600" />;
    if (fileType?.includes('video')) return <Video className="w-4 h-4 text-purple-600" />;
    if (fileType?.includes('audio')) return <Music className="w-4 h-4 text-green-600" />;
    if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
    return <File className="w-4 h-4 text-slate-600" />;
  };

  const getFileTypeFromName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv'].includes(extension || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(extension || '')) return 'audio';
    if (extension === 'pdf') return 'pdf';
    return 'file';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return "";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const OnlineIndicator = ({ isOnline }: { isOnline?: boolean }) => {
    return (
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}></div>
    );
  };

  const StatusText = ({ isOnline, lastSeen }: { isOnline?: boolean; lastSeen?: string }) => {
    if (isOnline) {
      return <span className="text-xs text-green-600 font-medium">online</span>;
    }
    if (lastSeen) {
      return <span className="text-xs text-gray-500">last seen {formatLastSeen(lastSeen)}</span>;
    }
    return <span className="text-xs text-gray-500">offline</span>;
  };

  const renderMessageBubble = (msg: Message) => (
    <MessageBubble
      key={msg.id}
      msg={msg}
      onMarkAsRead={(messageId) => markMessageAsRead(messageId, msg.type === "file")}
      onDownload={handleDownload}
      onEditMessage={handleEditMessage}
      onDeleteMessage={(messageId) => handleDeleteMessage(messageId, msg.type === "file")}
    />
  );

  return (
    <MainLayout>
      <div className="flex h-full">
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={showAllUsers ? "Search all users..." : "Search contacts..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllUsers(!showAllUsers)}
              className="ml-2"
            >
              {showAllUsers ? "My Contacts" : "All Users"}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {(showAllUsers ? allUsers : contacts).map((user) => (
              <div
                key={user.id}
                onClick={() => startChat(user)}
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedContact?.id === user.id ? "bg-blue-50 border-blue-200" : ""}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {user.name.charAt(0)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <OnlineIndicator isOnline={user.isOnline} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                      {user.unread > 0 && (
                        <span className="ml-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                          {user.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <StatusText isOnline={user.isOnline} lastSeen={user.lastSeen} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        {selectedContact.image ? (
                          <img
                            src={selectedContact.image}
                            alt={selectedContact.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {selectedContact.name.charAt(0)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <OnlineIndicator isOnline={selectedContact.isOnline} />
                    </div>
                    <div>
                      <h2 className="font-medium text-slate-800">{selectedContact.name}</h2>
                      <StatusText isOnline={selectedContact.isOnline} lastSeen={selectedContact.lastSeen} />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                <div className="space-y-4">
                  {groupedMessages.map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      <div className="flex justify-center my-2">
                        <span className="bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded-full">
                          {formatChatDate(dateKey)}
                        </span>
                      </div>

                      {msgs.map(renderMessageBubble)}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* File preview section */}
              {fileUpload.file && (
                <div className="bg-white border-t border-slate-200 p-4">
                  <div className="flex items-center space-x-3 bg-slate-50 rounded-lg p-3">
                    {fileUpload.preview ? (
                      <img
                        src={fileUpload.preview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center">
                        {getFileIcon(fileUpload.file.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {fileUpload.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(fileUpload.file.size)}
                      </p>
                      {fileUpload.uploading && (
                        <Progress value={fileUpload.progress} className="mt-2" />
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {!fileUpload.uploading && (
                        <Button
                          size="sm"
                          onClick={handleFileUpload}
                          disabled={fileUpload.uploading}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveFile}
                        disabled={fileUpload.uploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border-t border-slate-200 p-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="*/*"
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUpload.uploading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                    disabled={fileUpload.uploading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || fileUpload.uploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">Select a conversation</h3>
                <p className="text-slate-600">Choose a contact to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}