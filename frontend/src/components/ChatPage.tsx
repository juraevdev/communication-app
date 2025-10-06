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
            Incoming {callInfo.callType === 'video' ? 'Video' : 'Audio'} Call
          </h2>

          <p className="text-gray-300 mb-6">
            {callInfo.fromUserName} someone calling you...
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={onReject}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-semibold"
            >
              <Phone className="h-5 w-5 mr-2" />
              Cancel
            </Button>

            <Button
              onClick={onAccept}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-semibold"
            >
              <Video className="h-5 w-5 mr-2" />
              Answer
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
    setChats,
    setGroups,
    setChannels,
    markAsRead,
    sendMessage,
    setMessages,
    connectToGroup,
    setCurrentUser,
    getGroupMembers,
    sendGroupMessage,
    connectToChatRoom,
    markGroupMessageAsRead,
    connectToChannel,
    sendChannelMessage,
    updateCurrentUserProfile,
    loadGroups,
    loadChannels,
  } = useChat();

  const [videoCallModalOpen, setVideoCallModalOpen] = useState(false)
  const [videoCallInfo, setVideoCallInfo] = useState<{
    roomId: string;
    type: 'private' | 'group';
    name: string;
  } | null>(null)

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
  const [refreshGroupsTrigger, setRefreshGroupsTrigger] = useState(0)
  const [refreshChannelsTrigger, setRefreshChannelsTrigger] = useState(0)
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
  

const handleProfileUpdate = async (updatedUser: any) => {
  try {
    const updatedData = await apiClient.updateUserProfile(updatedUser);
    console.log("Profile updated:", updatedData);

    if (updateCurrentUserProfile) {
      updateCurrentUserProfile(updatedData);
    }

    localStorage.setItem("user", JSON.stringify(updatedData));

    if (
      selectedChat &&
      selectedChat.type === "private" &&
      selectedChat.sender_id === currentUser?.id
    ) {
      setSelectedChat((prev: any) => (prev ? { ...prev, ...updatedData } : prev));
    }
  } catch (error) {
    console.error("Failed to update profile:", error);
  }
};

useEffect(() => {
  const fetchUser = async () => {
    try {
      const response = await apiClient.getMe();
      localStorage.setItem("user", JSON.stringify(response.data));
      setCurrentUser(response.data);
    } catch (err) {
      console.error("User fetch error:", err);
    }
  };

  fetchUser();
}, []);



  const refreshGroupsList = (leftGroupId?: number) => {
    if (leftGroupId) {
      setGroups(prev => prev.filter(group => group.id !== leftGroupId))

      if (selectedChat?.id === leftGroupId && selectedChat?.type === "group") {
        setSelectedChat(null)
      }
    } else {
      setRefreshGroupsTrigger(prev => prev + 1)
    }
  }

  const refreshChannelsList = (channelId?: number, isSubscribed?: boolean) => {
    if (channelId !== undefined) {
      setChannels(prev =>
        prev.map(channel =>
          channel.id === channelId
            ? { ...channel, isSubscribed: isSubscribed !== undefined ? isSubscribed : channel.isSubscribed }
            : channel
        )
      );

      if (selectedChat?.id === channelId && selectedChat?.type === "channel") {
        setSelectedChat((prev: { isSubscribed: any }) =>
          prev ? { ...prev, isSubscribed: isSubscribed !== undefined ? isSubscribed : prev.isSubscribed } : prev
        );
      }
    }

    setRefreshChannelsTrigger(prev => prev + 1);
  }

  useEffect(() => {
    if (refreshGroupsTrigger > 0) {
      loadGroups()
    }
  }, [refreshGroupsTrigger])

  useEffect(() => {
    if (refreshChannelsTrigger > 0) {
      loadChannels()
    }
  }, [refreshChannelsTrigger])

  const handleStartVideoCall = async () => {
    if (!selectedChat || !currentUser) return;

    try {
      const roomId = `videocall_${selectedChat.id}_${Date.now()}`;

      setVideoCallInfo({
        roomId,
        type: selectedChat.type === 'group' ? 'group' : 'private',
        name: getChatName(selectedChat)
      });

      await videoCall.startCall(roomId);

      if (selectedChat.type === 'private') {
        const targetUserId = selectedChat.id;   
        videoCall.sendCallInvitation(roomId, targetUserId, 'video');
      }

      setVideoCallModalOpen(true);
      console.log('[ChatPage] Video call started and invitation sent');

    } catch (error) {
      console.error('Failed to start video call:', error);
      alert('Video qo\'ng\'iroqni boshlash muvaffaqiyatsiz. Kamera/mikron ruxsatlarini tekshiring.');
    }
  };

  const handleEndVideoCall = () => {
    videoCall.endCall();
    setVideoCallModalOpen(false);
    setVideoCallInfo(null);
  };

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
          console.log(`[UI] Marking ${unreadMessages.length} messages as read in room ${roomId}`);

          unreadMessages.forEach(msg => {
            if (msg.type === "file") {
              markAsRead(roomId, undefined, msg.id)
            } else {
              markAsRead(roomId, msg.id)
            }
          })

          setChats(prev => prev.map(chat => {
            const chatRoomId = chat.room_id || chat.id?.toString();
            if (chatRoomId === roomId) {
              return { ...chat, unread: 0 };
            }
            return chat;
          }));
        }
      }
    }
  }, [selectedChat, messages, markAsRead])

  const getIsOwnMessage = (msg: any): boolean => {
    if (selectedChat?.type === "channel") {
      return msg.is_channel_owner || msg.can_edit || false;
    }

    if (msg.is_own !== undefined) {
      return msg.is_own;
    }

    if (msg.isOwn !== undefined) {
      return msg.isOwn;
    }

    const senderId = msg.sender?.id?.toString();
    const currentUserId = currentUser?.id?.toString();

    return senderId === currentUserId;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !selectedChat || !isConnected) return

    if (selectedChat.type === "group") {
      const groupId = selectedChat.id.toString()
      sendGroupMessage(groupId, message, replyingTo?.id)
      setMessage("")
      setReplyingTo(null)
    } else if (selectedChat.type === "channel") {
      const channelId = selectedChat.id.toString()
      sendChannelMessage(channelId, message)
      setMessage("")
    } else {
      const roomId = selectedChat.room_id || selectedChat.id?.toString()
      if (roomId) {
        sendMessage(roomId, message)
        setMessage("")
      }
    }
  }

  const handleChannelAction = async () => {
    if (!selectedChat || selectedChat.type !== "channel" || !currentUser) return

    setIsChannelActionLoading(true)
    try {
      const response = selectedChat.isSubscribed
        ? await apiClient.unfollowChannel(selectedChat.id, currentUser.id)
        : await apiClient.followChannel(selectedChat.id, currentUser.id);

      const newSubscriptionStatus = response.is_subscribed;

      console.log("[ChannelAction] New subscription status:", newSubscriptionStatus)

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

      await loadChannels()

    } catch (error) {
      console.error("Failed to perform channel action:", error)
    } finally {
      setIsChannelActionLoading(false)
    }
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


  useEffect(() => {
    if (selectedChat && selectedChat.type === "channel") {
      const channelId = selectedChat.id.toString();
      const currentMessages = messages[`channel_${channelId}`] || [];

      const unreadMessages = currentMessages.filter(msg =>
        !msg.is_read &&
        !msg.isOwn &&   
        msg.user?.id !== currentUser?.id  
      );

      if (unreadMessages.length > 0 && channelWsRef.current?.readyState === WebSocket.OPEN) {
        console.log(`[Channel] Marking ${unreadMessages.length} messages as read`);

        unreadMessages.forEach(msg => {
          channelWsRef.current?.send(JSON.stringify({
            action: "mark_as_read",
            message_id: msg.id
          }));
        });

        setChannels(prev => prev.map(channel =>
          channel.id.toString() === channelId ? { ...channel, unread: 0 } : channel
        ));
      }
    }
  }, [selectedChat, messages, channelWsRef, currentUser, setChannels]);

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
      if (!selectedChat.email || !selectedChat.username) {
        try {
          const userId = selectedChat.sender_id || selectedChat.id;
          console.log("Loading profile for user ID:", userId);

          const userData = await apiClient.getUserProfile(userId);
          console.log("User data for profile modal:", userData);

          const updatedChat = {
            ...selectedChat,
            username: userData.username || selectedChat.username,
            email: userData.email || selectedChat.email,
            name: userData.fullname || selectedChat.name,
            phone_number: userData.phone_number || selectedChat.phone_number
          };
          setSelectedChat(updatedChat);
        } catch (error) {
          console.error("Failed to load user profile:", error);
        }
      }
      setShowUserProfile(true);
    }
  }

  const handleChatSelect = async (chat: any) => {
    console.log("Selected chat:", chat);
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

      try {
        const userId = chat.sender_id || chat.id;
        console.log("Loading user profile for ID:", userId);

        const userData = await apiClient.getUserProfile(userId);
        console.log("User profile data from server:", userData);

        const updatedChat = {
          ...chat,
          username: userData.username || "user",
          email: userData.email || "",
          name: userData.fullname || chat.name || chat.sender,
          bio: userData.bio || "",
          phone_number: userData.phone_number || "",
          avatar: userData.avatar || chat.avatar,
          room_id: roomId
        };

        console.log("Updated chat with user data:", updatedChat);
        setSelectedChat(updatedChat);

        if (roomId) {
          connectToChatRoom(roomId)
        }
      } catch (error) {
        console.error("Failed to load user details:", error);
        if (roomId) {
          connectToChatRoom(roomId)
        }
      }
    }

    setLoadingMessages(false)
  }

  const handleStartChatFromContacts = async (contactUserId: number) => {
    try {
      setLoadingMessages(true);

      const userData = await apiClient.getUserProfile(contactUserId);
      const contacts = await apiClient.getContacts();

      console.log("[StartChat] All contacts:", contacts);

      const contact = contacts.find((c: any) =>
        c.contact_user === contactUserId  
      );

      console.log("[StartChat] Found contact:", contact);
      const alias = contact?.alias;
      console.log("[StartChat] Alias:", alias);

      const response = await apiClient.startChat(contactUserId);
      if (response.room_id) {
        const newChat = {
          id: contactUserId,
          sender_id: contactUserId,
          sender: userData.fullname || userData.username || "Foydalanuvchi",
          name: alias || userData.fullname || userData.username || "Foydalanuvchi",
          email: userData.email || "",
          avatar: userData.avatar || "",
          type: "private",
          unread: 0,
          last_message: "",
          timestamp: new Date().toISOString(),
          room_id: response.room_id.toString(),
          alias: alias,
          isContact: !!alias
        };

        console.log("[StartChat] New chat created:", newChat);

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

  const handleSearchUserSelect = async (user: any) => {
    try {
      setLoadingMessages(true);

      const newChat = {
        id: user.id,
        sender_id: user.id,
        sender: user.username || user.email,
        name: user.alias || user.username || user.email,  
        email: user.email,
        avatar: user.avatar,
        type: "private",
        unread: 0,
        last_message: "",
        timestamp: new Date().toISOString(),
        alias: user.alias,  
        isContact: !!user.alias   
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

  const handleChannelSelect = async (channel: any) => {
    console.log("Selected channel from search:", channel)

    const formattedChannel = {
      id: channel.id,
      name: channel.name,
      sender: channel.owner_name || "Noma'lum",
      sender_id: channel.owner,
      last_message: channel.last_message || channel.description || "",
      timestamp: channel.timestamp || channel.updated_at,
      unread: channel.unread_count || 0,
      avatar: "/channel-avatar.png",
      message_type: "text",
      room_id: `channel_${channel.id}`,
      type: "channel",
      description: channel.description,
      memberCount: channel.member_count || 0,
      isAdmin: channel.isOwner || channel.owner === currentUser?.id,
      isOwner: channel.isOwner || channel.owner === currentUser?.id,
      isSubscribed: channel.is_subscribed !== undefined ? channel.is_subscribed : false,
      username: channel.username
    }

    handleChatSelect(formattedChannel)
    setSearchQuery("")
    setChannelSearchResults([])
  }

  const handleCreateGroup = async (groupData: { name: string; description?: string }) => {
    try {
      const response = await apiClient.createGroup({
        ...groupData,
        created_by: currentUser.id
      })

      await loadGroups();

      return response;
    } catch (error) {
      console.error("Failed to create group:", error)
      throw error;
    }
  }

  const handleGroupCreated = () => {
    console.log("Group created, refreshing groups list...");
    loadGroups();
  }

  const handleCreateChannel = async (channelData: {
    name: string;
    description?: string;
    username: string;
    owner?: string;
  }) => {
    try {
      await apiClient.createChannel({
        ...channelData,
        owner: currentUser.id
      });

      await loadChannels();

    } catch (error) {
      console.error("Failed to create channel:", error);
      throw error;
    }
  };

  const handleChannelCreated = () => {
    console.log("Channel created, refreshing channels list...");
    loadChannels();
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
  }

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
        return date.toLocaleTimeString("en-En", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      else if (messageDate.getTime() === yesterday.getTime()) {
        return "Yesterday";
      }
      else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString("en-En", { weekday: "long" });
      }
      else {
        return date.toLocaleDateString("en-En", {
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

  const handleDeleteMessage = async (messageId: string, msg: any) => {
    if (!selectedChat || !isConnected) return;

    const isFile = isFileMessage(msg);
    console.log("[UI] Deleting message:", { messageId, isFile, msg });

    try {
      if (selectedChat.type === "group") {
        setMessages(prev => {
          const roomKey = `group_${selectedChat.id}`;
          const updatedMessages = (prev[roomKey] || []).filter(m => m.id !== messageId);
          return {
            ...prev,
            [roomKey]: updatedMessages,
          };
        });

        if (groupWsRef.current?.readyState === WebSocket.OPEN) {
          if (isFile) {
            groupWsRef.current.send(JSON.stringify({
              type: "delete_file",
              file_id: messageId
            }));
          } else {
            groupWsRef.current.send(JSON.stringify({
              type: "delete_message",
              message_id: messageId
            }));
          }
        }
      } else if (selectedChat.type === "channel") {
        setMessages(prev => {
          const roomKey = `channel_${selectedChat.id}`;
          const updatedMessages = (prev[roomKey] || []).filter(m => m.id !== messageId);
          return {
            ...prev,
            [roomKey]: updatedMessages,
          };
        });

        if (channelWsRef.current?.readyState === WebSocket.OPEN) {
          if (isFile) {
            channelWsRef.current.send(JSON.stringify({
              action: "delete_file",
              file_id: messageId
            }));
          } else {
            channelWsRef.current.send(JSON.stringify({
              action: "delete_message",
              message_id: messageId
            }));
          }
        }
      } else {
        const roomId = selectedChat.room_id || selectedChat.id?.toString();

        if (roomId) {
          setMessages(prev => {
            const updatedMessages = (prev[roomId] || []).filter(m => m.id !== messageId);
            return {
              ...prev,
              [roomId]: updatedMessages,
            };
          });
        }

        if (roomId && chatWsRef.current?.readyState === WebSocket.OPEN) {
          chatWsRef.current.send(JSON.stringify({
            action: isFile ? "delete_file" : "delete_message",
            message_id: messageId
          }));
        }
      }
    } catch (error) {
      console.error("Failed to delete message:", error);
      alert("Xabarni o'chirish muvaffaqiyatsiz. Iltimos, qayta urinib ko'ring.");

      if (selectedChat.type === "group") {
        const groupId = selectedChat.id.toString();
        connectToGroup(groupId);
      } else if (selectedChat.type === "channel") {
        const channelId = selectedChat.id.toString();
        connectToChannel(channelId);
      } else {
        const roomId = selectedChat.room_id || selectedChat.id?.toString();
        if (roomId) {
          connectToChatRoom(roomId);
        }
      }
    }
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString("en-En", { weekday: "long" });
    } else {
      return date.toLocaleDateString("en-En", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  };

  const isFileMessage = (msg: any): boolean => {
    if (!msg) return false;

    if (msg.message_type === "file") return true;
    if (msg.type === "file") return true;
    if (msg.file_url || msg.file_name) return true;
    if (msg.file_name && msg.file_url) return true;
    if (msg.message?.startsWith("File: ")) return true;
    if (msg.file_size) return true;

    if (msg.group_id && msg.file) return true;
    if (msg.channel_id && msg.file) return true;

    return false;
  };

  const getMessageStatus = (msg: any): "sending" | "sent" | "delivered" | "read" | "read_file" => {
    if (!msg) return "read"

    if (selectedChat?.type === "channel") {
      return msg.isOwn ? (msg.is_read ? "read" : "sent") : "read"
    }

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
    if (!chat) return "Noma'lum Chat"

    if (chat.type === "private") {
      return chat.alias || chat.name || chat.sender || "Unknown user"
    }

    return chat.name || chat.sender || "Unknown user"
  }

  useEffect(() => {
    if (chats.length > 0) {
      const refreshChatAliases = async () => {
        try {
          const contacts = await apiClient.getContacts();
          const contactsMap = new Map();

          console.log("[ChatPage] Contacts for aliases:", contacts);

          contacts.forEach((contact: any) => {
            console.log(`[ChatPage] Contact:`, contact);
            if (contact.contact_user) { 
              contactsMap.set(contact.contact_user, contact.alias);
            }
          });

          console.log("[ChatPage] Contacts map:", contactsMap);

          setChats(prevChats =>
            prevChats.map(chat => {
              const alias = contactsMap.get(chat.sender_id);
              console.log(`[ChatPage] Chat ${chat.id} (sender ${chat.sender_id}): alias = ${alias}`);

              if (alias) {
                const updatedChat = {
                  ...chat,
                  name: alias,
                  alias: alias,
                  isContact: true
                };
                console.log(`[ChatPage] Updated chat:`, updatedChat);
                return updatedChat;
              }
              console.log(`[ChatPage] No alias for chat:`, chat);
              return chat;
            })
          );
        } catch (error) {
          console.error("Failed to refresh chat aliases:", error);
        }
      };

      refreshChatAliases();
    }
  }, [chats.length]);

  const getSenderName = (sender: any): string => {
    if (!sender) return "Unknown"
    if (typeof sender === "string") return sender
    if (typeof sender === "object") {
      return sender.alias || sender.fullname || sender.full_name || sender.email || "Unknown user"
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size should be less than 10MB");
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
      if (!fileUrl.startsWith('https')) {
        downloadUrl = `https://planshet2.stat.uz/${fileUrl}`;
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
    name: "User",
    username: "User",
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
    username: selectedChat.username || "User",
    email: selectedChat.email || "",
    avatar: selectedChat.avatar || "",
    bio: selectedChat.bio || "",
    phone: selectedChat.phone_number || "",
    isContact: selectedChat.isContact || false,
    isOnline: selectedChat.isOnline || false,
    lastSeen: selectedChat.lastSeen || new Date().toISOString()
  } : safeCurrentUser

  const canSendMessage = () => {
    if (!selectedChat) return false

    if (selectedChat.type === "channel") {
      return selectedChat.isOwner === true || selectedChat.owner_id === currentUser?.id
    }

    return true
  }

  const shouldShowChannelActions = () => {
    if (!selectedChat || selectedChat.type !== "channel") return false

    if (selectedChat.isOwner === true || selectedChat.owner_id === currentUser?.id) {
      return false
    }

    return true
  }

  useEffect(() => {
    console.log("[UI Debug] Messages updated:", messages)
    console.log("[UI Debug] Selected chat:", selectedChat)
    console.log("[UI Debug] Current messages:", getCurrentMessages())
  }, [messages, selectedChat])

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
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowOwnProfile(true)}>
                  <User className="mr-2 h-4 w-4 text-white" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowContacts(true)}>
                  <UserPlus className="mr-2 h-4 w-4 text-white" />
                  Contacts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateGroup(true)}>
                  <Users className="mr-2 h-4 w-4 text-white" />
                  New Group
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={() => setShowCreateChannel(true)}>
                  <Hash className="mr-2 h-4 w-4 text-white" />
                  New Channel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-white cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Leave
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
              placeholder="Search..."
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
              Private
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
              Groups
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
              Channels
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {isSearching ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                <p className="text-gray-400">Searching...</p>
              </div>
            ) : displayChats.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400">
                  {searchQuery.trim() ? "User not found" : (
                    activeTab === "private" && chats.length === 0 ? "No chats" :
                      activeTab === "groups" && groups.length === 0 ? "No groups" :
                        activeTab === "channels" ? "No channels" : "Nothing found"
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
                          {isSearchResult ? (
                            activeTab === "channels" && item.type === "channel"
                              ? `${item.name}`
                              : item.username || item.email
                          ) : getChatName(item)}
                        </h3>
                        {!isSearchResult && (
                          <span className="text-xs text-gray-400">
                            {formatChatTime(item.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate">
                          {isSearchResult ? (
                            activeTab === "channels" && item.type === "channel"
                              ? item.username || "No description"
                              : (item.email || "No email")
                          ) : (
                            item.message_type === "file" ? "📎 File" : (item.last_message || "")
                          )}
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
                  <div className="text-gray-400">Loading...</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">No messages yet</p>
                    </div>
                  ) : (
                    Object.entries(groupMessagesByDate(currentMessages)).map(([dateKey, dateMessages]) => (
                      <div key={dateKey}>
                        <div className="flex justify-center my-4">
                          <div className="bg-gray-800 px-3 py-1 rounded-full">
                            <span className="text-xs text-gray-300 font-medium">
                              {formatDateHeader(dateKey)}
                            </span>
                          </div>
                        </div>

                        {dateMessages.map((msg) => {
                          const isRightAligned = getIsOwnMessage(msg);

                          const canEdit = msg.can_edit !== undefined ? msg.can_edit : isRightAligned;
                          const canDelete = msg.can_delete !== undefined ? msg.can_delete : isRightAligned;

                          return (
                            <div key={msg.id} className={`group flex gap-3 mb-4 ${isRightAligned ? "flex-row-reverse" : "flex-row"}`}>
                              {!isRightAligned && (
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarImage src={selectedChat?.type === "channel" ? "/channel-avatar.png" : "/diverse-group.png"} />
                                  <AvatarFallback className="bg-gray-600 text-white">
                                    {getAvatarLetter(getSenderName(msg.sender))}
                                  </AvatarFallback>
                                </Avatar>
                              )}

                              <div className={`max-w-xs lg:max-w-md ${isRightAligned ? "text-right" : "text-left"}`}>
                                {!isRightAligned && (selectedChat?.type === "channel" || selectedChat?.type === "group") && (
                                  <p className="text-sm font-medium text-white mb-1">
                                    {getSenderName(msg.sender)}
                                  </p>
                                )}

                                <div className="relative">
                                  {isRightAligned && (canEdit || canDelete) && (
                                    <div className="absolute -left-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                                      {!isFileMessage(msg) && canEdit && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400 hover:bg-gray-700"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingMessage({
                                              id: msg.id,
                                              content: msg.message,
                                              type: "text"
                                            });
                                          }}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      )}

                                      {canDelete && (
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
                                      )}
                                    </div>
                                  )}

                                  {selectedChat?.type === "group" && !isRightAligned && (
                                    <div className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400 hover:bg-gray-700"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReply(msg);
                                        }}
                                      >
                                        <Reply className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}

                                  <div className={`rounded-lg px-3 py-2 ${isRightAligned ? "bg-blue-600 text-white" : "bg-gray-700 text-white"}`}>
                                    {msg.reply_to && (
                                      <div className={`mb-2 pb-2 border-l-2 pl-2 ${isRightAligned ? "border-blue-300" : "border-gray-500"} opacity-80`}>
                                        <p className="text-xs font-semibold">
                                          {msg.reply_to.sender_fullname || msg.reply_to.sender || "User"}
                                        </p>
                                        <p className="text-xs truncate">
                                          {msg.reply_to.message_type === "file" 
                                            ? `📎 ${msg.reply_to.file_name || "Fayl"}` 
                                            : msg.reply_to.content || msg.reply_to.message || ""}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {isFileMessage(msg) ? (
                                      <div className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:opacity-80 ${isRightAligned ? "bg-blue-700" : "bg-gray-600"}`}
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
                                      <p className="text-xs opacity-70 mt-1">Edited</p>
                                    )}
                                  </div>

                                  <div className={`flex items-center gap-1 mt-1 ${isRightAligned ? "justify-end" : "justify-start"}`}>
                                    <span className="text-xs text-gray-400">
                                      {formatMessageTime(msg.timestamp)}
                                    </span>
                                    {isRightAligned && (
                                      <MessageStatus status={getMessageStatus(msg)} isOwn={false} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <TypingIndicator isVisible={isTyping} userName="Yozilmoqda..." />
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {replyingTo && (
              <div className="px-4 py-2 bg-gray-800 border-t border-gray-600">
                <div className="flex items-center justify-between bg-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Reply className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-blue-400 mb-1">
                        {getSenderName(replyingTo.sender)} replied to
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
              {shouldShowChannelActions() ? (
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
                        Leave channel
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        Join channel
                      </>
                    )}
                  </Button>
                </div>
              ) : canSendMessage() ? (
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
                      placeholder={replyingTo ? `${getSenderName(replyingTo.sender)} reply to...` : "Message..."}
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
                <div className="flex justify-center">
                  <p className="text-gray-400 text-sm">You can't send message!</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-950">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Choose chat</h3>
            </div>
          </div>
        )}
      </div>

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

      <VideoCallModal
        isOpen={videoCallModalOpen}
        onClose={handleEndVideoCall}
        callInfo={videoCallInfo}
        videoCall={videoCall}
      />

      <UserProfileModal
        isOpen={showOwnProfile}
        onClose={() => setShowOwnProfile(false)}
        user={safeCurrentUser}
        isOwnProfile={true}
        onProfileUpdate={handleProfileUpdate}
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
        onGroupCreated={handleGroupCreated}   
      />

      <CreateChannelModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        onCreateChannel={handleCreateChannel}
        currentUserId={currentUser?.id?.toString() || ""}
        onChannelCreated={handleChannelCreated}   
      />

      {selectedChat?.type === "group" && (
        <GroupInfoModal
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          group={{
            id: selectedChat.id || 0,
            name: getChatName(selectedChat),
            description: selectedChat.description || "No description",
            avatar: selectedChat.avatar || "",
            memberCount: selectedChat.memberCount || 0,
          }}
          onGroupUpdate={refreshGroupsList}
        />
      )}

      {selectedChat?.type === "channel" && (
        <ChannelInfoModal
          isOpen={showChannelInfo}
          onClose={() => setShowChannelInfo(false)}
          channel={{
            id: selectedChat.id || 0,
            name: getChatName(selectedChat),
            description: selectedChat.description || "No description",
            username: selectedChat.username || selectedChat.name?.toLowerCase().replace(/\s+/g, '_') || "channel",
            avatar: selectedChat.avatar || "",
            subscriberCount: selectedChat.subscriberCount || 0,
            isOwner: selectedChat.isOwner || false,
            isPrivate: selectedChat.isPrivate || false,
            isSubscribed: selectedChat.isSubscribed || false,
            isMuted: selectedChat.isMuted || false,
          }}
          onChannelUpdate={refreshChannelsList}   
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