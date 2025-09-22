import type React from "react"
import { apiClient } from "@/lib/api"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Menu,
  Search,
  MessageSquare,
  Users,
  Hash,
  Settings,
  UserPlus,
  LogOut,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  Video,
  User,
  Info,
  Music,
  FileText,
  X,
  Reply
} from "lucide-react"

import { ProfileModal } from "./profile-modal"
import { UserProfileModal } from "./user-profile-modal"
import { ContactsModal } from "./contacts-modal"
import { CreateGroupModal } from "./create-group-modal"
import { CreateChannelModal } from "./create-channel-modal"
import { GroupInfoModal } from "./group-info-modal"
import { ChannelInfoModal } from "./channel-info-modal"
import { MessageStatus } from "./message-status"
import { TypingIndicator } from "./typing-indicator"
import { useChat } from "@/hooks/use-chat"

export default function ChatPage() {
  const {
    chats,
    groups,
    messages,
    chatWsRef,
    groupWsRef,
    currentUser,
    isConnected,
    markAsRead,
    sendMessage,
    createGroup,
    connectToGroup,
    getGroupMembers,
    sendGroupMessage,
    connectToChatRoom,
    getGroupUnreadCount,
    markGroupMessageAsRead,
  } = useChat();

  const [selectedChat, setSelectedChat] = useState<any>(null)
  const [message, setMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showProfile, setShowProfile] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showChannelInfo, setShowChannelInfo] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set())
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState<"private" | "groups" | "channels">("private")
  const [groupMembers, setGroupMembers] = useState<any[]>([])
  const [group, setGroups] = useState<any[]>([])
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [fileUpload, setFileUpload] = useState<{
    file: File | null;
    preview: string | null;
    uploading: boolean;
    progress: number;
  }>({
    file: null,
    preview: null,
    uploading: false,
    progress: 0
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedChat?.id])

  useEffect(() => {
    if (selectedChat && selectedChat.unread > 0 && selectedChat.type !== "group") {
      const roomId = selectedChat.room_id || selectedChat.id?.toString()
      if (roomId) {
        const currentMessages = messages[roomId] || []

        const unreadMessages = currentMessages.filter(msg => !msg.is_read && !msg.isOwn)

        if (unreadMessages.length > 0) {
          unreadMessages.forEach(msg => {
            if (msg.type === "file") {
              markAsRead(roomId, undefined, msg.id)
            } else {
              markAsRead(roomId, msg.id)
            }
          })
        }
      }
    }
  }, [selectedChat, messages, markAsRead])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedChat || !isConnected) return

    if (selectedChat.type === "group") {
      const groupId = selectedChat.id.toString()
      sendGroupMessage(groupId, message, replyingTo?.id)
    } else {
      const roomId = selectedChat.room_id || selectedChat.id?.toString()
      if (roomId) {
        sendMessage(roomId, message)
      }
    }
    setMessage("")
    setReplyingTo(null)
  }

  const handleReply = (msg: any) => {
    setReplyingTo(msg)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMessage(value)
    if (selectedChat?.type === "group" && groupWsRef.current?.readyState === WebSocket.OPEN) {
      if (value.trim() && !isTypingTimeoutRef.current) {
        groupWsRef.current.send(JSON.stringify({
          type: "typing"
        }))

        isTypingTimeoutRef.current = setTimeout(() => {
          if (groupWsRef.current?.readyState === WebSocket.OPEN) {
            groupWsRef.current.send(JSON.stringify({
              type: "stop_typing"
            }))
          }
          isTypingTimeoutRef.current = null
        }, 3000)
      } else if (!value.trim() && isTypingTimeoutRef.current) {
        clearTimeout(isTypingTimeoutRef.current)
        isTypingTimeoutRef.current = null
        if (groupWsRef.current?.readyState === WebSocket.OPEN) {
          groupWsRef.current.send(JSON.stringify({
            type: "stop_typing"
          }))
        }
      }
    }
  }

  useEffect(() => {
    return () => {
      if (isTypingTimeoutRef.current) {
        clearTimeout(isTypingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedChat && selectedChat.unread > 0 && selectedChat.type === "group") {
      const groupId = selectedChat.id.toString();

      // Guruhdagi o'qilmagan xabarlarni o'qilgan deb belgilash
      const currentMessages = messages[`group_${groupId}`] || [];
      const unreadMessages = currentMessages.filter(msg => !msg.is_read && !msg.isOwn);

      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          markGroupMessageAsRead(groupId, msg.id);
        });

        getGroupUnreadCount(groupId);
      }
    }
  }, [selectedChat, messages, markGroupMessageAsRead, getGroupUnreadCount]);

  const handleChatHeaderClick = async () => {
    if (selectedChat?.type === "group") {
      try {
        const members = await getGroupMembers(selectedChat.id)
        setGroupMembers(members)
        setShowGroupInfo(true)
      } catch (error) {
        console.error("Failed to load group members:", error)
        setShowGroupInfo(true)
      }
    } else if (selectedChat?.type === "channel") {
      setShowChannelInfo(true)
    } else if (selectedChat?.type === "private") {
      setShowProfile(true)
    }
  }

  const handleChatSelect = async (chat: any) => {
    setSelectedChat(chat)
    setLoadingMessages(true)
    setReplyingTo(null)

    if (chat.type === "group") {
      setGroups(prev => prev.map(group => {
        if (group.id === chat.id) {
          return { ...group, unread: 0 };
        }
        return group;
      }));

      const groupId = chat.id.toString()
      connectToGroup(groupId)

      setTimeout(() => {
        if (groupWsRef.current && groupWsRef.current.readyState === WebSocket.OPEN) {
          groupWsRef.current.send(JSON.stringify({
            type: "mark_all_as_read"
          }));
        }
      }, 500);
    } else {
      const roomId = chat.room_id || chat.id?.toString()
      if (roomId) {
        connectToChatRoom(roomId)
      } else if (chat.sender_id) {
        try {
          const response = await apiClient.startChat(chat.sender_id)
          if (response.room_id) {
            const updatedChat = { ...chat, room_id: response.room_id.toString() }
            setSelectedChat(updatedChat)
            connectToChatRoom(response.room_id.toString())
          }
        } catch (error) {
          console.error("Failed to start chat:", error)
        }
      }
    }

    setLoadingMessages(false)
  }

  useEffect(() => {
    if (selectedChat && selectedChat.type === "group" && selectedChat.unread > 0) {
      setGroups(prev => prev.map(group => {
        if (group.id === selectedChat.id) {
          return { ...group, unread: 0 };
        }
        return group;
      }));
    }
  }, [selectedChat])

  const handleCreateGroup = async (groupData: { name: string; description?: string }) => {
    try {
      await createGroup(groupData.name, groupData.description)
      setShowCreateGroup(false)
    } catch (error) {
      console.error("Failed to create group:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
  }

  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return ""
    try {
      return new Date(timestamp).toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return timestamp
    }
  }

  const formatChatTime = (timestamp: string): string => {
    if (!timestamp) return ""
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)

      if (diffDays === 0) {
        return date.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        })
      } else if (diffDays === 1) {
        return "Kecha"
      } else if (diffDays < 7) {
        return `${diffDays} kun oldin`
      } else {
        return date.toLocaleDateString("uz-UZ")
      }
    } catch {
      return timestamp || ""
    }
  }

  const isFileMessage = (msg: any): boolean => {
    if (msg.message_type === "file") return true;

    if (msg.type === "file") return true;

    if (msg.message && msg.message.startsWith("File: ")) return true;

    if (msg.file_url || msg.file_name) return true;

    return false;
  };

  const getMessageStatus = (msg: any): "sending" | "sent" | "delivered" | "read" | "read_file" => {
    if (!msg) return "read"

    if (selectedChat?.type === "group") {
      return msg.is_read ? "read" : "sent"
    }

    if (!msg.isOwn) {
      return "read"
    }

    if (msg.type === "file") {
      return msg.is_read ? "read_file" : "sent"
    }

    return msg.is_read ? "read" : "sent"
  }

  const getChatName = (chat: any): string => {
    if (!chat) return "Unknown Chat"
    return chat.name || chat.sender || "Unknown User"
  }

  const getSenderName = (sender: any): string => {
    if (!sender) return "Unknown"
    if (typeof sender === "string") return sender
    if (typeof sender === "object") {
      return sender.fullname || sender.full_name || sender.email || "Unknown User"
    }
    return "Unknown"
  }

  const getAvatarLetter = (name: string): string => {
    if (!name || name === "undefined") return "U"
    return name.charAt(0).toUpperCase()
  }

  const getFilteredChats = () => {
    let chatsToFilter: any[] = []

    switch (activeTab) {
      case "private":
        chatsToFilter = chats
        break
      case "groups":
        chatsToFilter = groups
        break
      case "channels":
        chatsToFilter = []
        break
      default:
        chatsToFilter = chats
    }

    return chatsToFilter.filter((chat) => {
      const chatName = getChatName(chat).toLowerCase()
      const searchTerm = searchQuery
      return chatName.includes(searchTerm)
    })
  }

  const filteredChats = getFilteredChats()

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

  const handleFileUpload = async () => {
    if (!fileUpload.file || !selectedChat) return;

    setFileUpload(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      const isGroup = selectedChat.type === "group";

      if (isGroup) {
        const reader = new FileReader();

        reader.onload = (e) => {
          const base64Data = e.target?.result as string;
          const base64Content = base64Data.split(';base64,')[1];

          if (groupWsRef.current && groupWsRef.current.readyState === WebSocket.OPEN) {
            groupWsRef.current.send(JSON.stringify({
              type: "file_upload",
              file_data: base64Content,
              file_name: fileUpload.file!.name,
              file_type: fileUpload.file!.type,
              file_size: fileUpload.file!.size
            }));
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

        reader.onerror = () => {
          throw new Error("Failed to read file");
        };

        reader.readAsDataURL(fileUpload.file);
      } else {
        const wsRef = chatWsRef;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Data = e.target?.result as string;
            const base64Content = base64Data.split(';base64,')[1];

            if (wsRef.current) {
              wsRef.current.send(JSON.stringify({
                action: "upload_file",
                file_data: base64Content,
                file_name: fileUpload.file!.name,
                file_type: fileUpload.file!.type,
                file_size: fileUpload.file!.size
              }));
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

          reader.readAsDataURL(fileUpload.file);
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
      alert("Failed to upload file. Please try again.");
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
    if (fileType?.includes('image')) return <Paperclip className="h-4 w-4 text-blue-400" />;
    if (fileType?.includes('video')) return <Video className="h-4 w-4 text-purple-400" />;
    if (fileType?.includes('audio')) return <Music className="h-4 w-4 text-green-400" />;
    if (fileType?.includes('pdf')) return <FileText className="h-4 w-4 text-red-400" />;
    return <Paperclip className="h-4 w-4 text-gray-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const token = localStorage.getItem('access_token');

      let downloadUrl = fileUrl;
      if (!fileUrl.startsWith('http')) {
        downloadUrl = `http://localhost:8000${fileUrl}`;
      }

      console.log('Downloading file from:', downloadUrl);

      const response = await fetch(downloadUrl, {
        method: 'GET',
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
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
    }
  };

  useEffect(() => {
    if (selectedChat?.type === "group") {
      const groupId = selectedChat.id.toString();
      const currentMessages = messages[`group_${groupId}`] || [];

      const unreadMessages = currentMessages
        .filter(msg => !msg.isOwn && !msg.is_read)
        .slice(-3);

      if (unreadMessages.length > 0) {
        const timer = setTimeout(() => {
          unreadMessages.forEach(msg => {
            markGroupMessageAsRead(groupId, msg.id);
          });
        }, 2000);

        return () => clearTimeout(timer);
      }
    }
  }, [selectedChat, messages, markGroupMessageAsRead]);

  useEffect(() => {
    if (selectedChat?.type !== "group") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            const isOwn = entry.target.getAttribute('data-is-own') === 'true';
            const isRead = entry.target.getAttribute('data-is-read') === 'true';

            if (messageId && !isOwn && !isRead) {
              const groupId = selectedChat.id.toString();
              markGroupMessageAsRead(groupId, messageId);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [selectedChat, messages, markGroupMessageAsRead]);

  const isTyping = typingUsers.size > 0
  const typingUserNames = Array.from(typingUsers).map(userId => {
    return "Someone"
  }).join(', ')

  const getCurrentMessages = () => {
    if (!selectedChat) return []

    if (selectedChat.type === "group") {
      return messages[`group_${selectedChat.id}`] || []
    } else {
      return messages[selectedChat.room_id || selectedChat.id?.toString()] || []
    }
  }

  const handleMessageClick = (msg: any) => {
    if (selectedChat?.type === "group" && !msg.isOwn && !msg.is_read) {
      const groupId = selectedChat.id.toString();
      markGroupMessageAsRead(groupId, msg.id);
    }
  };

  const currentMessages = getCurrentMessages()

  return (
    <div className="flex h-screen bg-gray-950">
      <div className="w-80 border-r border-gray-500 bg-card flex flex-col">
        <div className="p-4 border-b border-gray-500">
          <div className="flex items-center justify-between mb-4 text-white">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2 cursor-pointer">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-gray-900">
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowUserProfile(true)}>
                  <User className="mr-2 h-4 w-4 text-white" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowContacts(true)}>
                  <UserPlus className="mr-2 h-4 w-4 text-white" />
                  Contacts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer">
                  <Settings className="mr-2 h-4 w-4 text-white" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateGroup(true)}>
                  <Users className="mr-2 h-4 w-4 text-white" />
                  New group
                </DropdownMenuItem>
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateChannel(true)}>
                  <Hash className="mr-2 h-4 w-4 text-white" />
                  New channel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold">ChatApp</h1>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={async (searchTerm) => setSearchQuery(await apiClient.searchUsers(searchTerm))}
              className="pl-10 border-gray-500 text-white bg-gray-800"
            />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-500">
          <div className="flex gap-1">
            <Button
              variant={activeTab === "private" ? "default" : "ghost"}
              size="sm"
              className="text-white"
              onClick={() => setActiveTab("private")}
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              Private
            </Button>
            <Button
              variant={activeTab === "groups" ? "default" : "ghost"}
              size="sm"
              className="text-white"
              onClick={() => setActiveTab("groups")}
            >
              <Users className="mr-1 h-3 w-3" />
              Groups
            </Button>
            <Button
              variant={activeTab === "channels" ? "default" : "ghost"}
              size="sm"
              className="text-white"
              onClick={() => setActiveTab("channels")}
            >
              <Hash className="mr-1 h-3 w-3" />
              Channels
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">
                  {activeTab === "private" && chats.length === 0 && "No chats"}
                  {activeTab === "groups" && groups.length === 0 && "No groups"}
                  {activeTab === "channels" && "No channels"}
                  {(
                    (activeTab === "private" && chats.length > 0) ||
                    (activeTab === "groups" && groups.length > 0)
                  ) && "Nothing found"}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={`${chat.type}-${chat.id}` || Math.random()}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors ${selectedChat?.id === chat.id && selectedChat?.type === chat.type ? "bg-gray-800" : ""
                    }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={chat.type === "group" ? "/group-avatar.png" : "/diverse-group.png"} />
                      <AvatarFallback className="bg-gray-600 text-white">
                        {getAvatarLetter(getChatName(chat))}
                      </AvatarFallback>
                    </Avatar>
                    {chat.type === "group" && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Users className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white truncate">
                        {getChatName(chat)}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {formatChatTime(chat.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400 truncate">
                        {chat.message_type === "file" ? "📎 File" : (chat.last_message || "")}
                      </p>
                      {chat.unread > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 text-white px-1.5">
                          {chat.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-gray-500 bg-gray-900">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors"
                  onClick={handleChatHeaderClick}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.type === "group" ? "/group-avatar.png" : "/diverse-group.png"} />
                    <AvatarFallback className="bg-gray-600 text-white">
                      {getAvatarLetter(getChatName(selectedChat))}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-white">
                      {getChatName(selectedChat)}
                    </h2>
                    {selectedChat.type === "group" && (
                      <p className="text-xs text-gray-400">
                        {selectedChat.memberCount || 0} members
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChat.type !== "group" && (
                    <>
                      <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800">
                        <Video className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800" onClick={handleChatHeaderClick}>
                    <Info className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 bg-gray-950">
              {loadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-gray-400">Loading messages...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">No messages yet</p>
                      <p className="text-xs text-gray-500 mt-1">Send the first message!</p>
                    </div>
                  ) : (
                    currentMessages.map((msg) => (
                      <div
                        key={msg.id || Math.random()}
                        className={`group flex gap-3 ${msg.isOwn ? "flex-row-reverse" : ""}`}
                        onClick={() => handleMessageClick(msg)}
                        style={{ cursor: !msg.isOwn && !msg.is_read ? 'pointer' : 'default' }}
                      >
                        {!msg.isOwn && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src="/diverse-group.png" />
                            <AvatarFallback className="bg-gray-600 text-white">
                              {getAvatarLetter(getSenderName(msg.sender))}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`max-w-xs lg:max-w-md ${msg.isOwn ? "text-right" : ""}`}>
                          {!msg.isOwn && (
                            <p className="text-sm font-medium text-white mb-1">
                              {getSenderName(msg.sender)}
                            </p>
                          )}
                          <div className="relative">
                            {/* Reply button - only show on hover and for non-own messages */}
                            {!msg.isOwn && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-white hover:bg-gray-700 p-1 h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReply(msg);
                                }}
                              >
                                <Reply className="h-3 w-3" />
                              </Button>
                            )}
                            
                            {/* Message content */}
                            <div
                              className={`rounded-lg px-3 py-2 ${msg.isOwn
                                ? "bg-blue-600 text-white"
                                : "bg-gray-700 text-white"
                                }`}
                            >
                              {/* Reply preview */}
                              {msg.reply_to && (
                                <div className="mb-2 p-2 bg-black bg-opacity-20 rounded border-l-2 border-blue-400">
                                  <p className="text-xs opacity-70 mb-1">
                                    Replying to {msg.reply_to.sender || "Unknown"}
                                  </p>
                                  <p className="text-sm opacity-90 truncate">
                                    {msg.reply_to.content || msg.reply_to.message || "Message"}
                                  </p>
                                </div>
                              )}

                              {isFileMessage(msg) ? (
                                <div
                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:opacity-80 ${msg.isOwn ? "bg-blue-700" : "bg-gray-600"}`}
                                  onClick={() => handleDownload(msg.file_url || "", msg.file_name || msg.message?.replace("File: ", "") || "file")}
                                >
                                  {getFileIcon(msg.file_type || msg.type)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {msg.file_name || msg.message?.replace("File: ", "") || "File"}
                                    </p>
                                    {msg.file_size && (
                                      <p className="text-xs opacity-70">
                                        {formatFileSize(Number(msg.file_size))}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere max-w-full">
                                  {msg.message || ""}
                                </p>
                              )}
                              {msg.is_updated && (
                                <p className="text-xs opacity-70 mt-1">edited</p>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 mt-1">
                              <p className="text-xs text-gray-400">
                                {formatMessageTime(msg.timestamp)}
                              </p>
                              {selectedChat.type !== "group" && (
                                <MessageStatus status={getMessageStatus(msg)} isOwn={msg.isOwn} />
                              )}
                              {selectedChat.type === "group" && msg.isOwn && (
                                <MessageStatus
                                  status={msg.is_read ? "read" : "sent"}
                                  isOwn={msg.isOwn}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <TypingIndicator isVisible={isTyping} userName="Typing..." />
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply preview bar */}
            {replyingTo && (
              <div className="px-4 py-2 bg-gray-800 border-t border-gray-600">
                <div className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Reply className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-400 mb-1">
                        Replying to {getSenderName(replyingTo.sender)}
                      </p>
                      <p className="text-sm text-white truncate">
                        {isFileMessage(replyingTo) 
                          ? `📎 ${replyingTo.file_name || "File"}` 
                          : replyingTo.message
                        }
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelReply}
                    className="text-gray-400 hover:text-white hover:bg-gray-600 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {fileUpload.file && (
              <div className="p-4 border-t border-gray-500 bg-gray-800">
                <div className="flex items-center space-x-3 bg-gray-700 rounded-lg p-3">
                  {fileUpload.preview ? (
                    <img
                      src={fileUpload.preview}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-600 rounded flex items-center justify-center">
                      {getFileIcon(fileUpload.file.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {fileUpload.file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(fileUpload.file.size)}
                    </p>
                    {fileUpload.uploading && (
                      <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${fileUpload.progress}%` }}
                        />
                      </div>
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
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveFile}
                      disabled={fileUpload.uploading}
                      className="text-white hover:bg-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 border-t border-gray-500 bg-gray-900">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="*/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-gray-800"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isConnected}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder={replyingTo ? `Reply to ${getSenderName(replyingTo.sender)}...` : "Type a message..."}
                    value={message}
                    onChange={handleMessageChange}
                    className="pr-10 bg-gray-800 border-gray-600 text-white"
                    disabled={!isConnected}
                  />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:bg-gray-700">
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="submit" size="sm" disabled={!isConnected || !message.trim()} className="bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-950">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Select a chat</h3>
              <p className="text-gray-400">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowUserProfile(false)}
        user={selectedChat || {
          id: 0,
          fullname: "Loading...",
          email: "",
        }}
        isOwnProfile={false}
      />

      <UserProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowProfile(false)}
        user={currentUser || {
          id: 0,
          fullname: "Loading...",
          email: "",
        }}
        isOwnProfile={true}
      />

      <ContactsModal isOpen={showContacts} onClose={() => setShowContacts(false)} />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />

      <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} />

      {selectedChat?.type === "group" && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          group={{
            id: selectedChat.id || 0,
            name: getChatName(selectedChat),
            description: selectedChat.description || "No group description",
            avatar: selectedChat.avatar || "",
            memberCount: selectedChat.memberCount || 0,
          }}
        />
      )}

      {selectedChat?.type === "channel" && (
        <ChannelInfoModal
          isOpen={showChannelInfo}
          onClose={() => setShowChannelInfo(false)}
          channel={{
            id: selectedChat.id || 0,
            name: getChatName(selectedChat),
            description: selectedChat.description || "No channel description",
            username: selectedChat.username || "channel",
            avatar: selectedChat.avatar || "",
            subscriberCount: selectedChat.subscriberCount || 0,
            isAdmin: selectedChat.isAdmin || false,
            isPrivate: selectedChat.isPrivate || false,
            isSubscribed: selectedChat.isSubscribed || false,
            isMuted: selectedChat.isMuted || false,
          }}
        />
      )}
    </div>
  )
}