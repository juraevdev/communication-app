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
  UserPlus,
  LogOut,
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  User,
  Info,
  Music,
  FileText,
  X,
  Reply,
  UserCheck,
  UserMinus,
  Edit,
  Trash2,
  MoreVertical
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
import { EditMessageModal } from "./edit-message"
import { VideoCallModal } from "./video-call-modal"
import { useVideoCall } from "@/hooks/use-videocall"

// Incoming Call Modal komponenti
const IncomingCallModal = ({ 
  isOpen, 
  onAccept, 
  onReject, 
  callInfo 
}: { 
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
  callInfo: { fromUserName: string; callType: 'video' | 'audio' } | null;
}) => {
  if (!isOpen || !callInfo) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Video className="h-10 w-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            Kelayotgan {callInfo.callType === 'video' ? 'Video' : 'Audio'} Qo'ng'iroq
          </h2>
          
          <p className="text-gray-300 mb-6">
            {callInfo.fromUserName} sizga qo'ng'iroq qilmoqda...
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={onReject}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-semibold"
            >
              <Phone className="h-5 w-5 mr-2" />
              Rad etish
            </Button>
            
            <Button
              onClick={onAccept}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-semibold"
            >
              <Video className="h-5 w-5 mr-2" />
              Qabul qilish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChatPage() {
  const {
    chats,
    groups,
    channels,
    messages,
    chatWsRef,
    groupWsRef,
    channelWsRef,
    currentUser,
    isConnected,
    setGroups,
    setChannels,
    markAsRead,
    sendMessage,
    connectToGroup,
    getGroupMembers,
    sendGroupMessage,
    connectToChatRoom,
    markGroupMessageAsRead,
    connectToChannel,
    sendChannelMessage,
  } = useChat();

  // Video call state
  const [videoCallModalOpen, setVideoCallModalOpen] = useState(false)
  const [videoCallInfo, setVideoCallInfo] = useState<{
    roomId: string;
    type: 'private' | 'group';
    name: string;
  } | null>(null)

  // Video call hook
  const videoCall = useVideoCall({
    currentUserId: currentUser?.id,
    currentUserName: currentUser?.name || currentUser?.username || 'User'
  })

  const [selectedChat, setSelectedChat] = useState<any>(null)
  const [message, setMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [channelSearchResults, setChannelSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showOwnProfile, setShowOwnProfile] = useState(false)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showChannelInfo, setShowChannelInfo] = useState(false)
  const [typingUsers,] = useState<Set<number>>(new Set())
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [activeTab, setActiveTab] = useState<"private" | "groups" | "channels">("private")
  const [, setGroupMembers] = useState<any[]>([])
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [isChannelActionLoading, setIsChannelActionLoading] = useState(false)
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
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
    type: "text" | "file";
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Video call funksiyalari
  const handleStartVideoCall = async () => {
    if (!selectedChat || !currentUser) return;

    try {
      const roomId = `videocall_${selectedChat.id}_${Date.now()}`;

      setVideoCallInfo({
        roomId,
        type: selectedChat.type === 'group' ? 'group' : 'private',
        name: getChatName(selectedChat)
      });

      // Avvalo call ni boshlash
      await videoCall.startCall(roomId);
      
      // Keyin taklif yuborish
      if (selectedChat.type === 'private') {
        videoCall.sendCallInvitation(roomId, 'video');
      }
      
      setVideoCallModalOpen(true);
      console.log('[ChatPage] Video call started and invitation sent');

    } catch (error) {
      console.error('Failed to start video call:', error);
      alert('Video qo\'ng\'iroqni boshlash muvaffaqiyatsiz. Kamera/mikron ruxsatlarini tekshiring.');
    }
  };

  const handleJoinVideoCall = async (roomId: string) => {
    try {
      setVideoCallInfo({
        roomId,
        type: selectedChat?.type === 'group' ? 'group' : 'private',
        name: selectedChat ? getChatName(selectedChat) : 'Qo\'ng\'iroq'
      });

      await videoCall.joinCall(roomId);
      setVideoCallModalOpen(true);
    } catch (error) {
      console.error('Failed to join video call:', error);
      alert('Video qo\'ng\'iroqqa qo\'shilish muvaffaqiyatsiz. Kamera/mikron ruxsatlarini tekshiring.');
    }
  };

  const handleEndVideoCall = () => {
    videoCall.endCall();
    setVideoCallModalOpen(false);
    setVideoCallInfo(null);
  };

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedChat?.id])

  // Mark as read effect
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

  // Send message handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedChat || !isConnected) return

    if (selectedChat.type === "group") {
      const groupId = selectedChat.id.toString()
      sendGroupMessage(groupId, message, replyingTo?.id)
    } else if (selectedChat.type === "channel") {
      const channelId = selectedChat.id.toString()
      sendChannelMessage(channelId, message)
    } else {
      const roomId = selectedChat.room_id || selectedChat.id?.toString()
      if (roomId) {
        sendMessage(roomId, message)
      }
    }
    setMessage("")
    setReplyingTo(null)
  }

  // Channel action handler
  const handleChannelAction = async () => {
    if (!selectedChat || selectedChat.type !== "channel" || !currentUser) return

    setIsChannelActionLoading(true)
    try {
      const response = selectedChat.isSubscribed
        ? await apiClient.unfollowChannel(selectedChat.id, currentUser.id)
        : await apiClient.followChannel(selectedChat.id, currentUser.id);

      const newSubscriptionStatus = response.is_subscribed;

      setSelectedChat((prev: any) => ({
        ...prev,
        isSubscribed: newSubscriptionStatus
      }))

      setChannels(prev => prev.map(channel =>
        channel.id === selectedChat.id
          ? { ...channel, isSubscribed: newSubscriptionStatus }
          : channel
      ))

      if (newSubscriptionStatus) {
        const channelId = selectedChat.id.toString()
        connectToChannel(channelId)
      } else {
        if (channelWsRef.current) {
          channelWsRef.current.close()
        }
      }

    } catch (error) {
      console.error("Failed to perform channel action:", error)
      alert("Kanal amalini bajarish muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.")
    } finally {
      setIsChannelActionLoading(false)
    }
  }

  // Reply handlers
  const handleReply = (msg: any) => {
    setReplyingTo(msg)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  // Typing handler
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

  // Cleanup typing timeout
  useEffect(() => {
    return () => {
      if (isTypingTimeoutRef.current) {
        clearTimeout(isTypingTimeoutRef.current)
      }
    }
  }, [])

  // Group messages mark as read
  useEffect(() => {
    if (selectedChat && selectedChat.type === "group") {
      const groupId = selectedChat.id.toString();
      const currentMessages = messages[`group_${groupId}`] || [];

      const unreadMessages = currentMessages.filter(msg =>
        !msg.is_read &&
        !msg.isOwn
      );

      if (unreadMessages.length > 0) {
        unreadMessages.forEach(msg => {
          markGroupMessageAsRead(groupId, msg.id);
        });

        setGroups(prev => prev.map(group =>
          group.id.toString() === groupId ? { ...group, unread: 0 } : group
        ));
      }
    }
  }, [selectedChat, messages, markGroupMessageAsRead, setGroups]);

  // Chat header click handler
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
      setShowUserProfile(true)
    }
  }

  // Chat select handler
  const handleChatSelect = async (chat: any) => {
    console.log("Selected chat:", chat);
    console.log("Chat isSubscribed:", chat.isSubscribed);
    console.log("Chat isOwner:", chat.isOwner);

    setSelectedChat(chat)
    setLoadingMessages(true)
    setReplyingTo(null)
    setSearchQuery("")
    setSearchResults([])

    if (chat.type === "group") {
      setGroups(prev => prev.map(g =>
        g.id === chat.id ? { ...g, unread: 0 } : g
      ));

      const groupId = chat.id.toString()
      connectToGroup(groupId)
    } else if (chat.type === "channel") {
      const channelId = chat.id.toString()
      if (chat.isSubscribed || chat.isOwner) {
        connectToChannel(channelId)
      }
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

  // Start chat from contacts
  const handleStartChatFromContacts = async (contactUserId: number) => {
    try {
      setLoadingMessages(true);

      const userData = await apiClient.getUserProfile(contactUserId);

      const response = await apiClient.startChat(contactUserId);
      if (response.room_id) {
        const newChat = {
          id: contactUserId,
          sender_id: contactUserId,
          sender: userData.fullname || userData.username || "Foydalanuvchi",
          name: userData.fullname || userData.username || "Foydalanuvchi",
          email: userData.email || "",
          avatar: userData.avatar || "",
          type: "private",
          unread: 0,
          last_message: "",
          timestamp: new Date().toISOString(),
          room_id: response.room_id.toString()
        };

        setSelectedChat(newChat);
        connectToChatRoom(response.room_id.toString());
      }

      setShowContacts(false);
      setLoadingMessages(false);
    } catch (error) {
      console.error("Failed to start chat from contacts:", error);
      setLoadingMessages(false);
    }
  };

  // Search user select handler
  const handleSearchUserSelect = async (user: any) => {
    try {
      setLoadingMessages(true);

      const newChat = {
        id: user.id,
        sender_id: user.id,
        sender: user.username || user.email,
        name: user.username || user.email,
        email: user.email,
        avatar: user.avatar,
        type: "private",
        unread: 0,
        last_message: "",
        timestamp: new Date().toISOString()
      }

      const response = await apiClient.startChat(user.id);
      if (response.room_id) {
        const updatedChat = { ...newChat, room_id: response.room_id.toString() };
        setSelectedChat(updatedChat);
        connectToChatRoom(response.room_id.toString());
      }

      setSearchQuery("");
      setSearchResults([]);
      setLoadingMessages(false);
    } catch (error) {
      console.error("Failed to start chat:", error);
      setLoadingMessages(false);
    }
  };

  // Channel select handler
  const handleChannelSelect = async (channel: any) => {
    console.log("Selected channel from search:", channel)

    const formattedChannel = {
      id: channel.id,
      name: channel.name,
      sender: channel.owner_name || "Noma'lum",
      sender_id: channel.owner,
      last_message: channel.description || "",
      timestamp: channel.updated_at,
      unread: channel.unread_count || 0,
      avatar: "/channel-avatar.png",
      message_type: "text",
      room_id: `channel_${channel.id}`,
      type: "channel",
      description: channel.description,
      memberCount: channel.member_count || 0,
      isAdmin: channel.owner === currentUser?.id,
      isOwner: channel.owner === currentUser?.id,
      isSubscribed: channel.is_subscribed || false,
      username: channel.username
    }

    handleChatSelect(formattedChannel)
    setSearchQuery("")
    setChannelSearchResults([])
  }

  // Create group handler
  const handleCreateGroup = async (groupData: { name: string; description?: string }) => {
    try {
      await apiClient.createGroup({
        ...groupData,
        created_by: currentUser.id
      })
      setShowCreateGroup(false)
    } catch (error) {
      console.error("Failed to create group:", error)
    }
  }

  // Create channel handler
  const handleCreateChannel = async (channelData: {
    name: string;
    description?: string;
    username: string;
    owner?: string
  }) => {
    try {
      await apiClient.createChannel({
        ...channelData,
        owner: currentUser.id
      })
      setShowCreateChannel(false)
    } catch (error) {
      console.error("Failed to create channel:", error)
    }
  }

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
  }

  // Time formatting functions
  const formatMessageTime = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (messageDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      else if (messageDate.getTime() === yesterday.getTime()) {
        return "Kecha";
      }
      else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString("uz-UZ", { weekday: "long" });
      }
      else {
        return date.toLocaleDateString("uz-UZ", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
      }
    } catch {
      return timestamp;
    }
  };

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

  // Message grouping by date
  const groupMessagesByDate = (messages: any[]) => {
    const grouped: { [key: string]: any[] } = {};

    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedMessages.forEach((msg) => {
      if (!msg.timestamp) return;

      const date = new Date(msg.timestamp);
      const dateKey = date.toDateString();

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(msg);
    });

    return grouped;
  };

  // Edit message handler
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!selectedChat || !isConnected) return;

    try {
      if (selectedChat.type === "group") {
        if (groupWsRef.current?.readyState === WebSocket.OPEN) {
          groupWsRef.current.send(JSON.stringify({
            type: "edit_message",
            message_id: messageId,
            new_content: newContent
          }));
        }
      } else if (selectedChat.type === "channel") {
        if (channelWsRef.current?.readyState === WebSocket.OPEN) {
          channelWsRef.current.send(JSON.stringify({
            action: "edit_message",
            message_id: messageId,
            new_content: newContent
          }));
        }
      } else {
        const roomId = selectedChat.room_id || selectedChat.id?.toString();
        if (roomId && chatWsRef.current?.readyState === WebSocket.OPEN) {
          chatWsRef.current.send(JSON.stringify({
            action: "edit_message",
            message_id: messageId,
            new_content: newContent
          }));
        }
      }
    } catch (error) {
      console.error("Failed to edit message:", error);
      alert("Xabarni tahrirlash muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
    }
  };

  // Delete message handler
  const handleDeleteMessage = async (messageId: string, msg: any) => {
    if (!selectedChat || !isConnected) return;

    const isFile = isFileMessage(msg);

    try {
      if (selectedChat.type === "group") {
        if (groupWsRef.current?.readyState === WebSocket.OPEN) {
          groupWsRef.current.send(JSON.stringify({
            action: isFile ? "delete_file" : "delete_message",
            [isFile ? "file_id" : "message_id"]: messageId
          }));
        }
      } else if (selectedChat.type === "channel") {
        if (channelWsRef.current?.readyState === WebSocket.OPEN) {
          channelWsRef.current.send(JSON.stringify({
            action: isFile ? "delete_file" : "delete_message",
            [isFile ? "file_id" : "message_id"]: messageId
          }));
        }
      } else {
        const roomId = selectedChat.room_id || selectedChat.id?.toString();
        if (roomId && chatWsRef.current?.readyState === WebSocket.OPEN) {
          chatWsRef.current.send(JSON.stringify({
            action: isFile ? "delete_file" : "delete_message",
            [isFile ? "file_id" : "message_id"]: messageId
          }));
        }
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
      alert("Xabarni o'chirish muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
    }
  };

  // Date header formatter
  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return "Bugun";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Kecha";
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString("uz-UZ", { weekday: "long" });
    } else {
      return date.toLocaleDateString("uz-UZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  };

  // File message checker
  const isFileMessage = (msg: any): boolean => {
    if (msg.message_type === "file") return true;
    if (msg.type === "file") return true;
    if (msg.file_url || msg.file_name) return true;
    if (msg.file_name && msg.file_url) return true;
    return false;
  };

  // Message status getter
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

  // Chat name getter
  const getChatName = (chat: any): string => {
    if (!chat) return "Noma'lum Chat"
    return chat.name || chat.sender || "Noma'lum Foydalanuvchi"
  }

  // Sender name getter
  const getSenderName = (sender: any): string => {
    if (!sender) return "Noma'lum"
    if (typeof sender === "string") return sender
    if (typeof sender === "object") {
      return sender.fullname || sender.full_name || sender.email || "Noma'lum Foydalanuvchi"
    }
    return "Noma'lum"
  }

  // Avatar letter getter
  const getAvatarLetter = (name: string): string => {
    if (!name || name === "undefined") return "U"
    return name.charAt(0).toUpperCase()
  }

  // Filter chats based on active tab and search
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
        if (searchQuery.trim() && channelSearchResults.length > 0) {
          chatsToFilter = channelSearchResults.map(channel => ({
            ...channel,
            type: "channel",
            sender: channel.owner_name || "Noma'lum",
            sender_id: channel.owner,
            last_message: channel.description || "",
            timestamp: channel.updated_at,
            unread: channel.unread_count || 0,
            avatar: "/channel-avatar.png",
            message_type: "text",
            room_id: `channel_${channel.id}`,
            memberCount: channel.members?.length || 0,
            isAdmin: channel.owner === currentUser?.id,
            isOwner: channel.owner === currentUser?.id,
            isSubscribed: channel.members?.includes(currentUser?.id) || channel.owner === currentUser?.id,
            username: channel.username
          }))
        } else {
          chatsToFilter = channels
        }
        break
      default:
        chatsToFilter = chats
    }

    if (activeTab !== "channels" && searchQuery.trim()) {
      return chatsToFilter.filter((chat) => {
        const chatName = getChatName(chat).toLowerCase()
        const searchTerm = searchQuery.toLowerCase()
        return chatName.includes(searchTerm)
      })
    }

    return chatsToFilter
  }

  const displayChats = (() => {
    if (searchQuery.trim()) {
      if (activeTab === "channels") {
        return getFilteredChats()
      } else if (activeTab === "private") {
        return searchResults
      }
    }
    return getFilteredChats()
  })()

  // File handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("Fayl hajmi 10MB dan kichik bo'lishi kerak");
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
      const isChannel = selectedChat.type === "channel";

      if (isGroup || isChannel) {
        const reader = new FileReader();

        reader.onload = (e) => {
          const base64Data = e.target?.result as string;
          const base64Content = base64Data.split(';base64,')[1];

          if (isChannel && channelWsRef.current?.readyState === WebSocket.OPEN) {
            channelWsRef.current.send(JSON.stringify({
              action: "upload_file",
              file_data: base64Content,
              file_name: fileUpload.file!.name,
              file_type: fileUpload.file!.type,
              file_size: fileUpload.file!.size
            }));
          }
          else if (isGroup && groupWsRef.current?.readyState === WebSocket.OPEN) {
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

        reader.onerror = (error) => {
          console.error("[Upload] File read error:", error);
          setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
          alert("Faylni o'qish muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
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

          reader.onerror = (error) => {
            console.error("[Upload] File read error:", error);
            setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
            alert("Faylni o'qish muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
          };

          reader.readAsDataURL(fileUpload.file);
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
      alert("Faylni yuklash muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");
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

  const isTyping = typingUsers.size > 0

  const getCurrentMessages = () => {
    if (!selectedChat) return []

    if (selectedChat.type === "group") {
      return messages[`group_${selectedChat.id}`] || []
    } else if (selectedChat.type === "channel") {
      return messages[`channel_${selectedChat.id}`] || []
    } else {
      const roomId = selectedChat.room_id || selectedChat.id?.toString()
      return messages[roomId] || []
    }
  }

  const currentMessages = getCurrentMessages()

  const safeCurrentUser = currentUser || {
    id: 0,
    name: "Foydalanuvchi",
    username: "foydalanuvchi",
    email: "",
    avatar: "",
    bio: "",
    phone: "",
    isContact: false,
    isOnline: true,
    lastSeen: new Date().toISOString()
  }

  const safeSelectedChatUser = selectedChat ? {
    id: selectedChat.id || 0,
    name: getChatName(selectedChat),
    username: selectedChat.username || "foydalanuvchi",
    email: selectedChat.email || "",
    avatar: selectedChat.avatar || "",
    bio: selectedChat.bio || "",
    phone: selectedChat.phone_number || "",
    isContact: selectedChat.isContact || false,
    isOnline: selectedChat.isOnline || false,
    lastSeen: selectedChat.lastSeen || new Date().toISOString()
  } : safeCurrentUser

  // Check if current user can send messages to channel
  const canSendMessage = () => {
    if (!selectedChat) return false

    if (selectedChat.type === "channel") {
      return selectedChat.isOwner === true || selectedChat.owner_id === currentUser?.id
    }

    return true
  }

  // Check if user should see join/leave buttons
  const shouldShowChannelActions = () => {
    if (!selectedChat || selectedChat.type !== "channel") return false

    if (selectedChat.isOwner === true || selectedChat.owner_id === currentUser?.id) {
      return false
    }

    return true
  }

  // Debug effect
  useEffect(() => {
    console.log("[UI Debug] Messages updated:", messages)
    console.log("[UI Debug] Selected chat:", selectedChat)
    console.log("[UI Debug] Current messages:", getCurrentMessages())
  }, [messages, selectedChat])

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
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
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowOwnProfile(true)}>
                  <User className="mr-2 h-4 w-4 text-white" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowContacts(true)}>
                  <UserPlus className="mr-2 h-4 w-4 text-white" />
                  Kontaktlar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateGroup(true)}>
                  <Users className="mr-2 h-4 w-4 text-white" />
                  Yangi guruh
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateChannel(true)}>
                  <Hash className="mr-2 h-4 w-4 text-white" />
                  Yangi kanal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Chiqish
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold">NewGram</h1>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="chat-search-users-input"
              name="chat-search-users"
              placeholder="Foydalanuvchilarni qidirish..."
              value={searchQuery}
              autoComplete="new-password"
              data-form-type="search"
              onChange={async (e) => {
                const value = e.target.value
                setSearchQuery(value)
                if (value.trim()) {
                  setIsSearching(true)
                  try {
                    if (activeTab === "private") {
                      const results = await apiClient.searchUsers(value)
                      setSearchResults(results || [])
                    } else if (activeTab === "channels") {
                      const allChannelsResponse = await apiClient.getChannelsFilter(value)
                      setChannelSearchResults(allChannelsResponse || [])
                    }
                  } catch (err) {
                    console.error("Search error:", err)
                    setSearchResults([])
                    setChannelSearchResults([])
                  } finally {
                    setIsSearching(false)
                  }
                } else {
                  setSearchResults([])
                  setChannelSearchResults([])
                  setIsSearching(false)
                }
              }}
              className="pl-10 border-gray-500 text-white bg-gray-800"
            />
          </div>
        </div>

        <div className="px-4 py-2 border-b border-gray-500">
          <div className="flex gap-1">
            <Button
              variant={activeTab === "private" ? "default" : "ghost"}
              size="sm"
              className={`flex items-center ${activeTab === "private"
                ? "bg-gray-700 text-white hover:bg-gray-800 cursor-pointer hover:scale-105 transition duration-300"
                : "text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer hover:scale-105 transition duration-300"
                }`}
              onClick={() => setActiveTab("private")}
            >
              <MessageSquare className="mr-1 h-3 w-3" />
              Shaxsiy
            </Button>

            <Button
              variant={activeTab === "groups" ? "default" : "ghost"}
              size="sm"
              className={`flex items-center ${activeTab === "groups"
                ? "bg-gray-700 text-white hover:bg-gray-800 cursor-pointer hover:scale-105 transition duration-300"
                : "text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer hover:scale-105 transition duration-300"
                }`}
              onClick={() => setActiveTab("groups")}
            >
              <Users className="mr-1 h-3 w-3" />
              Guruhlar
            </Button>

            <Button
              variant={activeTab === "channels" ? "default" : "ghost"}
              size="sm"
              className={`flex items-center ${activeTab === "channels"
                ? "bg-gray-700 text-white hover:bg-gray-800 cursor-pointer hover:scale-105 transition duration-300"
                : "text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer hover:scale-105 transition duration-300"
                }`}
              onClick={() => setActiveTab("channels")}
            >
              <Hash className="mr-1 h-3 w-3" />
              Kanallar
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {isSearching ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                <p className="text-gray-400">Qidirilmoqda...</p>
              </div>
            ) : displayChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">
                  {searchQuery.trim() ? "Foydalanuvchi topilmadi" : (
                    activeTab === "private" && chats.length === 0 ? "Chatlar yo'q" :
                      activeTab === "groups" && groups.length === 0 ? "Guruhlar yo'q" :
                        activeTab === "channels" ? "Kanallar yo'q" : "Hech narsa topilmadi"
                  )}
                </p>
              </div>
            ) : (
              displayChats.map((item, index) => {
                const isSearchResult = searchQuery.trim() && (
                  (activeTab === "private" && searchResults.includes(item)) ||
                  (activeTab === "channels" && channelSearchResults.some(ch => ch.id === item.id))
                )
                const isChannelSearchResult = activeTab === "channels" && searchQuery.trim()

                return (
                  <div
                    key={isSearchResult ? `search-${item.id}` : `${item.type}-${item.id}` || index}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors ${selectedChat?.id === item.id && selectedChat?.type === item.type ? "bg-gray-800" : ""
                      }`}
                    onClick={() => {
                      if (isChannelSearchResult) {
                        handleChannelSelect(item)
                      } else if (isSearchResult && activeTab === "private") {
                        handleSearchUserSelect(item)
                      } else {
                        handleChatSelect(item)
                      }
                    }}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={
                          item.type === "group" ? "/group-avatar.png" :
                            item.type === "channel" ? "/channel-avatar.png" : "/diverse-group.png"
                        } />
                        <AvatarFallback className="bg-gray-600 text-white">
                          {isSearchResult ? getAvatarLetter(item.username || item.email) : getAvatarLetter(getChatName(item))}
                        </AvatarFallback>
                      </Avatar>
                      {item.type === "group" && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <Users className="h-2 w-2 text-white" />
                        </div>
                      )}
                      {item.type === "channel" && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                          <Hash className="h-2 w-2 text-white" />
                        </div>
                      )}
                      {isSearchResult && item.type !== "group" && item.type !== "channel" && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <User className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-white truncate">
                          {isSearchResult ? (item.username || item.email) : getChatName(item)}
                        </h3>
                        {!isSearchResult && (
                          <span className="text-xs text-gray-400">
                            {formatChatTime(item.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate">
                          {isSearchResult ?
                            (item.email || "Foydalanuvchi") :
                            (item.message_type === "file" ? "📎 Fayl" : (item.last_message || ""))
                          }
                        </p>
                        {!isSearchResult && item.unread > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 text-white px-1.5">
                            {item.unread}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
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
                    <p className="text-sm text-gray-400">
                      {selectedChat.type === "private" && (selectedChat.isOnline ? "Onlayn" : "Offlayn")}
                      {selectedChat.type === "group" && `${selectedChat.memberCount || 0} a'zo`}
                      {selectedChat.type === "channel" && `${selectedChat.subscriberCount || 0} obunachi`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChat.type == "private" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-gray-800"
                        onClick={handleStartVideoCall}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {selectedChat.type == "group" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-gray-800"
                        onClick={handleStartVideoCall}
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="text-white hover:bg-gray-800" onClick={handleChatHeaderClick}>
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 bg-gray-950">
              {loadingMessages ? (
                <div className="flex justify-center items-center h-32">
                  <div className="text-gray-400">Xabarlar yuklanmoqda...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">Hali xabarlar yo'q</p>
                      <p className="text-xs text-gray-500 mt-1">Birinchi xabarni yuboring!</p>
                    </div>
                  ) : (
                    Object.entries(groupMessagesByDate(currentMessages)).map(([dateKey, dateMessages]) => (
                      <div key={dateKey}>
                        {/* Date header */}
                        <div className="flex justify-center my-4">
                          <div className="bg-gray-800 px-3 py-1 rounded-full">
                            <span className="text-xs text-gray-300 font-medium">
                              {formatDateHeader(dateKey)}
                            </span>
                          </div>
                        </div>

                        {/* Messages for this date */}
                        {dateMessages.map((msg) => (
                          <div
                            key={msg.id || Math.random()}
                            className={`group flex gap-3 mb-4 ${msg.isOwn ? "flex-row-reverse" : ""}`}
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
                                {/* Reply button */}
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

                                {msg.isOwn && (
                                  <div className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400 hover:bg-gray-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingMessage({
                                          id: msg.id,
                                          content: msg.message,
                                          type: isFileMessage(msg) ? "file" : "text"
                                        });
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-gray-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Bu xabarni o'chirishni istaysizmi?")) {
                                          handleDeleteMessage(msg.id, msg);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
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
                                    <div className="mb-2 p-2 bg-blue-800 bg-opacity-20 rounded border-l-2 border-blue-400">
                                      <p className="text-xs opacity-70 mb-1">
                                        {msg.reply_to.sender || "Noma'lum"} ga javob
                                      </p>
                                      <p className="text-sm opacity-90 truncate">
                                        {msg.reply_to.content || msg.reply_to.message || "Xabar"}
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
                                          {msg.file_name || msg.message?.replace("File: ", "") || "Fayl"}
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
                                    <p className="text-xs opacity-70 mt-1">tahrirlangan</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 mt-1">
                                  <p className="text-xs text-gray-400">
                                    {formatMessageTime(msg.timestamp)}
                                  </p>
                                  {selectedChat.type !== "group" && (
                                    <MessageStatus status={getMessageStatus(msg)} isOwn={msg.isOwn} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                  <TypingIndicator isVisible={isTyping} userName="Yozilmoqda..." />
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
                        {getSenderName(replyingTo.sender)} ga javob
                      </p>
                      <p className="text-sm text-white truncate">
                        {isFileMessage(replyingTo)
                          ? `📎 ${replyingTo.file_name || "Fayl"}`
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

            {/* File upload preview */}
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

            {/* Message input */}
            <div className="p-4 border-t border-gray-500 bg-gray-900">
              {shouldShowChannelActions() ? (
                // Channel join/leave button for non-owners
                <div className="flex justify-center">
                  <Button
                    onClick={handleChannelAction}
                    disabled={isChannelActionLoading}
                    className={`flex items-center gap-2 ${selectedChat.isSubscribed
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                  >
                    {isChannelActionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : selectedChat.isSubscribed ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        Kanaldan Chiqish
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Kanalga Qo'shilish
                      </>
                    )}
                  </Button>
                </div>
              ) : canSendMessage() ? (
                // Normal message input for owners and non-channel chats
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
                      placeholder={replyingTo ? `${getSenderName(replyingTo.sender)} ga javob...` : "Xabar yozing..."}
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
              ) : (
                // Disabled state for non-subscribed channels (shouldn't normally show)
                <div className="flex justify-center">
                  <p className="text-gray-400 text-sm">Siz bu kanalga xabar yubora olmaysiz</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-950">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Chat tanlang</h3>
              <p className="text-gray-400">Xabar almashish uchun suhbatni tanlang</p>
            </div>
          </div>
        )}
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={videoCall.isRinging}
        onAccept={videoCall.acceptCall}
        onReject={videoCall.rejectCall}
        callInfo={
          videoCall.incomingCall ? {
            fromUserName: videoCall.incomingCall.fromUserName,
            callType: videoCall.incomingCall.callType
          } : null
        }
      />

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={videoCallModalOpen}
        onClose={handleEndVideoCall}
        callInfo={videoCallInfo}
        videoCall={videoCall}
      />

      {/* Modals */}
      <UserProfileModal
        isOpen={showOwnProfile}
        onClose={() => setShowOwnProfile(false)}
        user={safeCurrentUser}
        isOwnProfile={true}
      />

      <ProfileModal
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        user={safeSelectedChatUser}
        isOwnProfile={false}
      />

      <ContactsModal
        isOpen={showContacts}
        onClose={() => setShowContacts(false)}
        onStartChat={handleStartChatFromContacts}
      />

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreateGroup={handleCreateGroup}
      />

      <CreateChannelModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreateChannel={handleCreateChannel}
        currentUserId={currentUser?.id?.toString() || ""}
      />

      {selectedChat?.type === "group" && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          group={{
            id: selectedChat.id || 0,
            name: getChatName(selectedChat),
            description: selectedChat.description || "Guruh tavsifi yo'q",
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
            description: selectedChat.description || "Kanal tavsifi yo'q",
            username: selectedChat.username || selectedChat.name?.toLowerCase().replace(/\s+/g, '_') || "kanal",
            avatar: selectedChat.avatar || "",
            subscriberCount: selectedChat.subscriberCount || 0,
            isOwner: selectedChat.isOwner || false,
            isPrivate: selectedChat.isPrivate || false,
            isSubscribed: selectedChat.isSubscribed || false,
            isMuted: selectedChat.isMuted || false,
          }}
        />
      )}

      <EditMessageModal
        isOpen={!!editingMessage}
        onClose={() => setEditingMessage(null)}
        onSave={(newContent) => {
          if (editingMessage) {
            handleEditMessage(editingMessage.id, newContent);
          }
        }}
        originalMessage={editingMessage?.content || ""}
        messageType={editingMessage?.type || "text"}
      />
    </div>
  )
}