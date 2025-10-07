import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient } from "@/lib/api"

export interface Message {
  [x: string]: any
  id: string
  room_id?: number
  group_id?: number
  channel_id?: number
  sender: {
    id: string
    email: string
    fullname: string
    full_name?: string
  }
  message: string
  timestamp: string
  isOwn: boolean
  is_read: boolean
  is_updated: boolean
  type: "text" | "file"
  file_name?: string
  file_url?: string
  file_type?: string
  file_size?: string
  reply_to?: any
  can_edit: boolean
  can_delete: boolean
  is_channel_owner: boolean
  status?: any
}

export interface Chat {
  username: any
  email: any
  isOwner: boolean
  isSubscribed: boolean
  id: number
  name: string
  sender: string
  sender_id: number
  last_message: string
  timestamp: string
  unread: number
  avatar: string
  message_type: "text" | "file"
  room_id?: string
  type?: "private" | "group" | "channel"
  description?: string
  memberCount?: number
  isAdmin?: boolean
}

export interface GroupMember {
  id: number
  user: number
  user_fullname: string
  user_username: string
  role: "owner" | "admin" | "member"
  joined_at: string
}

export interface Chat {
  id: number
  name: string
  sender: string
  sender_id: number
  last_message: string
  timestamp: string
  unread: number
  avatar: string
  message_type: "text" | "file"
  room_id?: string
  type?: "private" | "group" | "channel"
  description?: string
  memberCount?: number
  isAdmin?: boolean
}

export function useChat() {
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({})
  const [chats, setChats] = useState<Chat[]>([])
  const [groups, setGroups] = useState<Chat[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const statusWsRef = useRef<WebSocket | null>(null)
  const chatWsRef = useRef<WebSocket | null>(null)
  const groupWsRef = useRef<WebSocket | null>(null)
  const notificationsWsRef = useRef<WebSocket | null>(null)
  const currentRoomRef = useRef<string | null>(null)
  const currentGroupRef = useRef<string | null>(null)
  const groupConnectionsRef = useRef<Map<string, WebSocket>>(new Map())
  const [channels, setChannels] = useState<Chat[]>([])
  const channelWsRef = useRef<WebSocket | null>(null)
  const currentChannelRef = useRef<string | null>(null)
  const channelConnectionsRef = useRef<Map<string, WebSocket>>(new Map())


const updateCurrentUserProfile = useCallback((updatedData: any) => {
  console.log("[Chat] Updating current user profile:", updatedData);

  setCurrentUser((prev: any) => {
    const newUserData = { ...prev, ...updatedData };

    localStorage.setItem("user_data", JSON.stringify(newUserData));

    return newUserData;
  });

  setChats(prevChats =>
    prevChats.map(chat => {
      if (chat.sender_id === updatedData.id) {
        return {
          ...chat,
          name: updatedData.fullname || updatedData.username || chat.name,
          sender: updatedData.fullname || updatedData.username || chat.sender,
          username: updatedData.username || chat.username,
          email: updatedData.email || chat.email,
        };
      }
      return chat;
    })
  );

  console.log("✅ Profile update completed & localStorage synced");
}, [setCurrentUser, setChats]);


useEffect(() => {
  const initializeUser = async () => {
    try {
      const cachedUser = localStorage.getItem("user_data");
      
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        setCurrentUser(parsedUser);
        console.log("[Chat] Cached user loaded:", parsedUser);
      }

      const response = await apiClient.getMe();
      const user = response.data;
      
      if (!cachedUser || JSON.stringify(user) !== cachedUser) {
        setCurrentUser(user);
        localStorage.setItem("user_data", JSON.stringify(user));
        console.log("[Chat] Fresh user loaded from API:", user);
      }

      initializeStatusWebSocket();
      initializeNotificationsWebSocket();
      await loadGroups();

    } catch (error) {
      console.error("❌ Failed to load user:", error);
    }
  };

  initializeUser();
}, []);


  const loadGroups = useCallback(async () => {
    try {
      const groupsData = await apiClient.getGroups()
      const formattedGroups: Chat[] = groupsData.map((group: any) => ({
        id: group.id,
        name: group.name,
        sender: group.name,
        sender_id: group.created_by,
        last_message: "",
        timestamp: group.last_message_time || group.updated_at,
        unread: 0,
        avatar: "/group-avatar.png",
        message_type: "text",
        room_id: `group_${group.id}`,
        type: "group",
        description: group.description,
        memberCount: 0,
        isAdmin: group.created_by === currentUser?.id,
      }))

      formattedGroups.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setGroups(formattedGroups)

      formattedGroups.forEach(group => {
        initializeGroupBackgroundListener(group.id.toString())
      })
    } catch (error) {
      console.error("[Chat] Failed to load groups:", error)
    }
  }, [currentUser])

  const initializeGroupBackgroundListener = useCallback((groupId: string) => {
    if (groupConnectionsRef.current.has(groupId)) {
      return
    }

    try {
      const groupWs = new WebSocket(apiClient.getGroupWebSocketUrl(groupId))

      groupWs.onopen = () => {
        console.log(`[Chat] Group background listener connected to group ${groupId}`)
      }

      groupWs.onmessage = (event) => {
        const data = JSON.parse(event.data)

        // Faqat ochiq bo'lmagan guruhlar uchun notification
        if (currentGroupRef.current !== groupId) {
          switch (data.type) {
            case "chat_message":
            case "file_uploaded":
              // Boshqa a'zoning xabari kelsa - unread count oshadi
              if (data.sender_id !== currentUser?.id) {
                setGroups(prev => prev.map(group => {
                  if (group.id.toString() === groupId) {
                    return { ...group, unread: (group.unread || 0) + 1 };
                  }
                  return group;
                }));
              }
              break;

            case "unread_count":
              // Backend periodic ravishda har bir a'zoga o'zining unread count'ini yuborishi mumkin
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
              break;
          }
        }
      }

      groupWs.onclose = () => {
        groupConnectionsRef.current.delete(groupId)
        setTimeout(() => {
          if (currentUser && !groupConnectionsRef.current.has(groupId)) {
            initializeGroupBackgroundListener(groupId)
          }
        }, 3000)
      }

      groupConnectionsRef.current.set(groupId, groupWs)
    } catch (error) {
      console.error("[Chat] Failed to initialize group background listener:", error)
    }
  }, [currentUser])

  const initializeStatusWebSocket = useCallback(() => {
    try {
      const statusWs = new WebSocket(apiClient.getStatusWebSocketUrl())

      statusWs.onopen = () => {
        console.log("[Chat] Status WebSocket connected")
        setIsConnected(true)
      }

      statusWs.onclose = () => {
        console.log("[Chat] Status WebSocket disconnected")
        setIsConnected(false)
        setTimeout(() => {
          if (statusWsRef.current?.readyState === WebSocket.CLOSED) {
            initializeStatusWebSocket()
          }
        }, 3000)
      }

      statusWs.onerror = (error) => {
        console.error("[Chat] Status WebSocket error:", error)
      }

      statusWsRef.current = statusWs
    } catch (error) {
      console.error("[Chat] Failed to initialize status WebSocket:", error)
    }
  }, [])

  const loadChatsWithAliases = async () => {
    try {
      // Kontaktlarni olish
      const contacts = await apiClient.getContacts();
      const contactsMap = new Map();

      console.log("[DEBUG] Contacts from API:", contacts);

      // Kontaktlarni map ga joylash - contact_user ID sifatida
      contacts.forEach((contact: any) => {
        console.log(`[DEBUG] Processing contact:`, contact);
        if (contact.contact_user) { // contact_user ID raqam
          contactsMap.set(contact.contact_user, {
            alias: contact.alias,
            isContact: true
          });
        }
      });

      console.log("[DEBUG] Contacts map:", contactsMap);

      // Chatlarni yangilash
      setChats(prevChats =>
        prevChats.map(chat => {
          console.log(`[DEBUG] Checking chat:`, {
            chatId: chat.id,
            senderId: chat.sender_id,
            chatName: chat.name
          });

          const contactInfo = contactsMap.get(chat.sender_id);
          console.log(`[DEBUG] Contact info for sender ${chat.sender_id}:`, contactInfo);

          if (contactInfo) {
            const updatedChat = {
              ...chat,
              name: contactInfo.alias || chat.name,
              alias: contactInfo.alias,
              isContact: true
            };
            console.log(`[DEBUG] Updated chat:`, updatedChat);
            return updatedChat;
          }

          const unchangedChat = {
            ...chat,
            alias: null,
            isContact: false
          };
          console.log(`[DEBUG] Unchanged chat:`, unchangedChat);
          return unchangedChat;
        })
      );
    } catch (error) {
      console.error("[Chat] Failed to load contacts for chats:", error);
    }
  };

  const initializeNotificationsWebSocket = useCallback(() => {
    try {
      const notificationsWs = new WebSocket(apiClient.getNotificationsWebSocketUrl())

      notificationsWs.onopen = () => {
        console.log("[Chat] Notifications WebSocket connected")
        notificationsWs.send(
          JSON.stringify({
            action: "get_recent_conversations",
          }),
        )
      }

      notificationsWs.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log("[Chat] Notification received:", data)

        switch (data.type) {
          case "recent_conversations":
            if (data.conversations && Array.isArray(data.conversations)) {
              const formattedChats: Chat[] = data.conversations.map((conv: any) => ({
                id: conv.id,
                name: conv.sender || "Unknown User",
                sender: conv.sender || "Unknown User",
                sender_id: conv.sender_id || 0,
                last_message: conv.last_message || "",
                timestamp: conv.timestamp,
                unread: conv.unread || 0,
                avatar: "/diverse-group.png",
                message_type: conv.message_type || "text",
                room_id: conv.id?.toString(),
                type: "private",
                alias: null, // Hozircha null
                isContact: false // Hozircha false
              }))

              console.log("[DEBUG] Formatted chats before aliases:", formattedChats);
              setChats(formattedChats)

              // Chatlar yuklangandan so'ng alias larni yuklash
              setTimeout(() => {
                loadChatsWithAliases();
              }, 100);
            }
            break

          case "unread_count_update":
            updateChatUnreadCount(data.contact_id, data.unread_count)
            break

          default:
            console.log("[Chat] Unknown notification type:", data.type)
        }
      }

      notificationsWs.onclose = () => {
        console.log("[Chat] Notifications WebSocket disconnected")
        setTimeout(() => {
          if (notificationsWsRef.current?.readyState === WebSocket.CLOSED) {
            initializeNotificationsWebSocket()
          }
        }, 3000)
      }

      notificationsWs.onerror = (error) => {
        console.error("[Chat] Notifications WebSocket error:", error)
      }

      notificationsWsRef.current = notificationsWs
    } catch (error) {
      console.error("[Chat] Failed to initialize notifications WebSocket:", error)
    }
  }, [currentUser])

  const connectToChatRoom = useCallback(
    (roomId: string) => {
      if (currentRoomRef.current === roomId && chatWsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      if (chatWsRef.current) {
        chatWsRef.current.close()
      }

      try {
        const chatWs = new WebSocket(apiClient.getChatWebSocketUrl(roomId))

        chatWs.onopen = () => {
          console.log(`[Chat] Chat WebSocket connected to room ${roomId}`)
          currentRoomRef.current = roomId
        }

        chatWs.onmessage = (event) => {
          const data = JSON.parse(event.data)
          console.log("[Chat] Chat message received:", data)

          switch (data.type) {
            case "message_history":
              if (data.messages && Array.isArray(data.messages)) {
                const formattedMessages: Message[] = data.messages.map((msg: any) => ({
                  id: msg.id,
                  room_id: parseInt(roomId),
                  sender: msg.sender,
                  message: msg.message,
                  timestamp: msg.timestamp,
                  isOwn: msg.sender.id === currentUser?.id?.toString(),
                  is_read: msg.is_read,
                  is_updated: msg.is_updated,
                  type: msg.type || "text",
                  file_name: msg.file_name,
                  file_url: msg.file_url,
                  file_type: msg.file_type,
                  file_size: msg.file_size,
                })).reverse()

                setMessages((prev) => ({
                  ...prev,
                  [roomId]: formattedMessages,
                }))
              }
              break

            case "chat_message":
              if (data.id) {
                const newMessage: Message = {
                  id: data.id,
                  room_id: parseInt(roomId),
                  sender: data.sender,
                  message: data.message,
                  timestamp: data.timestamp,
                  isOwn: data.sender.id === currentUser?.id?.toString(),
                  is_read: data.is_read,
                  is_updated: data.is_updated,
                  type: data.type || "text",
                  file_name: data.file_name,
                  file_url: data.file_url,
                  file_type: data.file_type,
                  file_size: data.file_size,
                  can_edit: false,
                  can_delete: false,
                  is_channel_owner: false
                }

                addMessage(roomId, newMessage)

                if (!newMessage.isOwn && currentRoomRef.current === roomId) {
                  setTimeout(() => {
                    if (newMessage.type === "file") {
                      markAsRead(roomId, undefined, newMessage.id)
                    } else {
                      markAsRead(roomId, newMessage.id)
                    }
                  }, 500)
                }
              }
              break

            case "message_updated":
              setMessages(prev => {
                const targetRoomId = data.room_id?.toString() || roomId;
                if (!targetRoomId) return prev;

                const updatedRoomMessages = (prev[targetRoomId] || []).map(msg => {
                  if (msg.id === data.message_id.toString()) {
                    return {
                      ...msg,
                      message: data.new_content,
                      is_updated: true
                    };
                  }
                  return msg;
                });

                return {
                  ...prev,
                  [targetRoomId]: updatedRoomMessages,
                };
              });
              break;


            case "message_deleted":
              console.log("[Chat] Message deleted:", data);
              setMessages(prev => {
                const roomId = data.room_id?.toString();
                if (!roomId) return prev;

                const updatedRoomMessages = (prev[roomId] || []).filter(msg => {
                  const isTargetMessage = msg.id === data.message_id?.toString() ||
                    msg.id === data.file_id?.toString();
                  return !isTargetMessage;
                });

                return {
                  ...prev,
                  [roomId]: updatedRoomMessages,
                };
              });
              break;

            case "file_uploaded":
              if (data.id) {
                const fileMessage: Message = {
                  id: data.id,
                  room_id: parseInt(roomId),
                  sender: data.user,
                  message: data.file_name,
                  timestamp: data.uploaded_at,
                  isOwn: data.user.id === currentUser?.id?.toString(),
                  is_read: false,
                  is_updated: false,
                  type: "file",
                  file_name: data.file_name,
                  file_url: data.file_url,
                  file_type: data.file_type || "file",
                  file_size: data.file_size,
                  can_edit: false,
                  can_delete: false,
                  is_channel_owner: false
                }

                addMessage(roomId, fileMessage)

                if (!fileMessage.isOwn && currentRoomRef.current === roomId) {
                  setTimeout(() => {
                    markAsRead(roomId, undefined, fileMessage.id)
                  }, 500)
                }
              }
              break

            // Chat WebSocket handler
            case "read":
              setMessages(prev => {
                const roomId = data.room_id?.toString();
                if (!roomId) return prev;

                const updatedRoomMessages = (prev[roomId] || []).map(msg => {
                  if (data.message_id && msg.id === data.message_id.toString()) {
                    return { ...msg, is_read: true };
                  }
                  if (data.file_id && msg.id === data.file_id.toString()) {
                    return { ...msg, is_read: true };
                  }
                  return msg;
                });

                return {
                  ...prev,
                  [roomId]: updatedRoomMessages,
                };
              });

              // Chat ro'yxatini ham yangilash
              if (data.room_id) {
                setChats(prev => prev.map(chat => {
                  const chatRoomId = chat.room_id || chat.id?.toString();
                  if (chatRoomId === data.room_id.toString()) {
                    return { ...chat, unread: data.unread_count || 0 };
                  }
                  return chat;
                }));
              }
              break;
          }
        }

        chatWs.onclose = () => {
          console.log(`[Chat] Chat WebSocket disconnected from room ${roomId}`)
          currentRoomRef.current = null
        }

        chatWs.onerror = (error) => {
          console.error("[Chat] Chat WebSocket error:", error)
        }

        chatWsRef.current = chatWs
      } catch (error) {
        console.error("[Chat] Failed to connect to chat room:", error)
      }
    },
    [currentUser],
  )

  const connectToGroup = useCallback(
    (groupId: string) => {
      if (currentGroupRef.current === groupId && groupWsRef.current?.readyState === WebSocket.OPEN) {
        return
      }

      if (groupWsRef.current) {
        groupWsRef.current.close()
      }

      try {
        const groupWs = new WebSocket(apiClient.getGroupWebSocketUrl(groupId))

        groupWs.onopen = () => {
          console.log(`[Chat] Group WebSocket connected to group ${groupId}`)
          currentGroupRef.current = groupId

          groupWs.send(JSON.stringify({
            type: "get_history"
          }))

          // Backenddan joriy foydalanuvchi uchun unread count so'rash
          groupWs.send(JSON.stringify({
            type: "get_unread_count"
          }))
        }

        groupWs.onmessage = (event) => {
          const data = JSON.parse(event.data)
          console.log("[Chat] Group message received:", data)

          switch (data.type) {
            case "message_history":
              if (data.messages && Array.isArray(data.messages)) {
                const formattedMessages: Message[] = data.messages.map((msg: any) => ({
                  id: msg.id.toString(),
                  group_id: parseInt(groupId),
                  sender: {
                    id: msg.sender_id?.toString(),
                    email: "",
                    fullname: msg.sender_fullname || "Unknown",
                    full_name: msg.sender_fullname || "Unknown",
                  },
                  message: msg.content || "",
                  timestamp: msg.created_at,
                  isOwn: msg.sender_id === currentUser?.id,
                  is_read: Boolean(msg.is_read),
                  is_updated: msg.is_updated || false,
                  type: msg.message_type || "text",
                  file_name: msg.file_name,
                  file_url: msg.file_url,
                  file_type: msg.file_type,
                  file_size: msg.file_size?.toString(),
                  reply_to: msg.reply_to ? {
                    id: msg.reply_to.id,
                    content: msg.reply_to.content,
                    sender_id: msg.reply_to.sender_id,
                    sender_fullname: msg.reply_to.sender_fullname,
                    sender: msg.reply_to.sender_fullname,
                    message: msg.reply_to.content,
                    message_type: msg.reply_to.message_type,
                    file_name: msg.reply_to.file_name
                  } : undefined,
                }))

                formattedMessages.sort((a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )

                setMessages((prev) => ({
                  ...prev,
                  [`group_${groupId}`]: formattedMessages,
                }))
              }
              break

            case 'initial_unread_count':
              // Guruhga birinchi ulanishda unread count
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
              break;

            case 'message_read_confirmed':
              // Xabar o'qilgandan keyin tasdiq
              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const updatedMessages = (prev[roomKey] || []).map(msg => {
                  if (msg.id === data.message_id.toString()) {
                    return { ...msg, is_read: true };
                  }
                  return msg;
                });

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });

              // Unread count yangilanishi
              if (data.unread_count !== undefined) {
                setGroups(prev => prev.map(group => {
                  if (group.id.toString() === groupId) {
                    return { ...group, unread: data.unread_count };
                  }
                  return group;
                }));
              }
              break;

            case "message_updated":
              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const updatedMessages = (prev[roomKey] || []).map(msg => {
                  if (msg.id === data.message_id.toString()) {
                    return {
                      ...msg,
                      message: data.new_content,
                      is_updated: true
                    };
                  }
                  return msg;
                });

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });
              break;

            case "message_deleted":
              console.log("[Chat] Group message deleted:", data);
              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const updatedMessages = (prev[roomKey] || []).filter(msg => {
                  return msg.id !== data.message_id.toString();
                });

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });
              break;

            case "chat_message":
              const newMessage: Message = {
                id: data.message?.id?.toString() || `temp-${Date.now()}`,
                group_id: parseInt(groupId),
                sender: {
                  id: data.sender_id.toString(),
                  email: "",
                  fullname: data.sender_name || data.sender_fullname || "Unknown",
                  full_name: data.sender_name || data.sender_fullname || "Unknown",
                },
                message: data.message?.content || data.message || "",
                timestamp: data.timestamp || new Date().toISOString(),
                isOwn: data.sender_id === currentUser?.id,
                is_read: data.sender_id === currentUser?.id,
                is_updated: false,
                type: data.message_type || "text",
                reply_to: data.reply_to ? {
                  id: data.reply_to.id,
                  content: data.reply_to.content,
                  sender_id: data.reply_to.sender_id,
                  sender_fullname: data.reply_to.sender_fullname,
                  sender: data.reply_to.sender_fullname,
                  message: data.reply_to.content,
                  message_type: data.reply_to.message_type,
                  file_name: data.reply_to.file_name
                } : undefined,
                file_name: data.file_name,
                file_url: data.file_url,
                file_type: data.file_type,
                file_size: data.file_size?.toString(),
                can_edit: false,
                can_delete: false,
                is_channel_owner: false
              }

              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const currentMessages = prev[roomKey] || [];

                if (currentMessages.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }

                const updatedMessages = [...currentMessages, newMessage];
                updatedMessages.sort((a, b) =>
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });
              break;

            case "unread_count":
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
              break;

            case "file_deleted":
              console.log("[Chat] Group file deleted:", data);
              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const updatedMessages = (prev[roomKey] || []).filter(msg => {
                  return msg.id !== data.file_id.toString();
                });

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });
              break;
          }
        }

        groupWs.onclose = () => {
          console.log(`[Chat] Group WebSocket disconnected from group ${groupId}`)
          currentGroupRef.current = null
        }

        groupWs.onerror = (error) => {
          console.error("[Chat] Group WebSocket error:", error)
        }

        groupWsRef.current = groupWs
      } catch (error) {
        console.error("[Chat] Failed to connect to group:", error)
      }
    },
    [currentUser],
  )

  const sendGroupFile = useCallback((
    fileData: string,
    fileName: string,
    fileType: string
  ) => {
    if (!groupWsRef.current || groupWsRef.current.readyState !== WebSocket.OPEN) {
      console.log("[Chat] Cannot send group file: WebSocket not ready")
      return
    }

    groupWsRef.current.send(
      JSON.stringify({
        type: "file_upload",
        file_data: fileData,
        file_name: fileName,
        file_type: fileType,
      }),
    )
  }, [])

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      if (!content.trim()) return

      const isGroup = roomId.startsWith('group_')

      if (isGroup) {
        if (!groupWsRef.current || groupWsRef.current.readyState !== WebSocket.OPEN) {
          console.log("[Chat] Cannot send group message: WebSocket not ready")
          return
        }

        groupWsRef.current.send(
          JSON.stringify({
            type: "chat_message",
            message: content.trim(),
          }),
        )
      } else {
        if (!chatWsRef.current || chatWsRef.current.readyState !== WebSocket.OPEN) {
          console.log("[Chat] Cannot send message: WebSocket not ready")
          return
        }

        chatWsRef.current.send(
          JSON.stringify({
            action: "send",
            message: content.trim(),
          }),
        )
      }
    },
    [],
  )

  const sendGroupMessage = useCallback(
    (groupId: string, content: string, replyToId?: string) => {
      if (!groupWsRef.current || groupWsRef.current.readyState !== WebSocket.OPEN || !content.trim()) {
        return
      }

      setGroups(prev => prev.map(group => {
        if (group.id.toString() === groupId) {
          return { ...group, unread: 0 };
        }
        return group;
      }));

      groupWsRef.current.send(
        JSON.stringify({
          type: "chat_message",
          message: content.trim(),
          reply_to: replyToId || null,
        }),
      )
    },
    [],
  )

  const markGroupMessageAsRead = useCallback((groupId: string, messageId: string) => {
    if (groupWsRef.current && groupWsRef.current.readyState === WebSocket.OPEN) {
      // Backendga xabarni o'qilgan deb belgilash so'rovi
      groupWsRef.current.send(JSON.stringify({
        type: "mark_as_read",
        message_id: messageId
      }));

      // Optimistic update - darhol UI'ni yangilash
      setMessages(prev => {
        const roomKey = `group_${groupId}`;
        const updatedMessages = (prev[roomKey] || []).map(msg => {
          if (msg.id === messageId) {
            return { ...msg, is_read: true };
          }
          return msg;
        });

        return {
          ...prev,
          [roomKey]: updatedMessages,
        };
      });

      // Unread count kamayadi
      setGroups(prev => prev.map(group => {
        if (group.id.toString() === groupId && group.unread > 0) {
          return { ...group, unread: Math.max(0, group.unread - 1) };
        }
        return group;
      }));
    }
  }, []);

  const getGroupUnreadCount = useCallback(() => {
    if (groupWsRef.current && groupWsRef.current.readyState === WebSocket.OPEN) {
      groupWsRef.current.send(JSON.stringify({
        type: "get_unread_count"
      }));
    }
  }, []);

  const markAsRead = useCallback(
    (roomId: string, messageId?: string, fileId?: string) => {
      console.log("[Chat] Marking as read:", { roomId, messageId, fileId });

      // Optimistic update - darhol UI ni yangilash
      setMessages(prev => {
        const updatedRoomMessages = (prev[roomId] || []).map(msg => {
          if ((messageId && msg.id === messageId) || (fileId && msg.id === fileId)) {
            return { ...msg, is_read: true };
          }
          return msg;
        });

        return {
          ...prev,
          [roomId]: updatedRoomMessages,
        };
      });

      // Chat ro'yxatidagi unread count ni yangilash
      setChats(prev => prev.map(chat => {
        const chatRoomId = chat.room_id || chat.id?.toString();
        if (chatRoomId === roomId && chat.unread > 0) {
          return { ...chat, unread: Math.max(0, chat.unread - 1) };
        }
        return chat;
      }));

      // WebSocket orqali backendga xabar berish
      if (chatWsRef.current && chatWsRef.current.readyState === WebSocket.OPEN) {
        const payload: any = {
          action: "read",
        };

        if (messageId) {
          payload.message_id = messageId;
        }

        if (fileId) {
          payload.file_id = fileId;
        }

        chatWsRef.current.send(JSON.stringify(payload));
      }
    },
    [],
  );

  const addMessage = useCallback((roomId: string, message: Message) => {
    setMessages((prev) => {
      const currentMessages = prev[roomId] || []

      const newMessages = [...currentMessages, message]
      newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return {
        ...prev,
        [roomId]: newMessages,
      }
    })
  }, [])

  const updateMessage = useCallback((roomId: string, messageId: string, newContent: string) => {
    setMessages((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] || []).map((msg) =>
        msg.id === messageId ? { ...msg, message: newContent, is_updated: true } : msg
      ),
    }))
  }, [])

  const removeMessage = useCallback((roomId: string, messageId: string) => {
    setMessages((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] || []).filter((msg) => msg.id !== messageId),
    }))
  }, [])

  const updateChatUnreadCount = useCallback((contactId: number, unreadCount: number) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.sender_id === contactId ? { ...chat, unread: unreadCount } : chat
      )
    )
  }, [])


  const createGroup = useCallback(async (name: string, description?: string) => {
    try {
      const response = await apiClient.createGroup({
        name,
        description,
        created_by: currentUser.id
      })
      await loadGroups()
      return response
    } catch (error) {
      console.error("[Chat] Failed to create group:", error)
      throw error
    }
  }, [currentUser, loadGroups])

  const addGroupMember = useCallback(async (groupId: number, userId: number, role: 'member' | 'admin' = 'member') => {
    try {
      const response = await apiClient.addGroupMember({
        group: groupId,
        user: userId,
        role
      })
      return response
    } catch (error) {
      console.error("[Chat] Failed to add group member:", error)
      throw error
    }
  }, [])

  const getGroupMembers = useCallback(async (groupId: number): Promise<GroupMember[]> => {
    try {
      const response = await apiClient.getGroupMembers(groupId)
      return response
    } catch (error) {
      console.error("[Chat] Failed to get group members:", error)
      return []
    }
  }, [])

  const initializeChannelBackgroundListener = useCallback((channelId: string) => {
    if (channelConnectionsRef.current.has(channelId)) {
      return;
    }

    try {
      const channelWs = new WebSocket(apiClient.getChannelWebSocketUrl(channelId))

      channelWs.onopen = () => {
        console.log(`[Chat] Channel background listener connected to channel ${channelId}`)
      }

      // use-chat.txt - initializeChannelBackgroundListener funksiyasida

      channelWs.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (currentChannelRef.current !== channelId) {
          switch (data.type) {
            case "chat_message":
            case "file_uploaded":
              if (data.message?.user?.id !== currentUser?.id?.toString()) {
                setChannels(prev => {
                  const updatedChannels = prev.map(channel => {
                    if (channel.id.toString() === channelId) {
                      return {
                        ...channel,
                        unread: (channel.unread || 0) + 1,
                        // ✅ Timestamp va last_message yangilash
                        timestamp: data.message?.created_at || new Date().toISOString(),
                        last_message: data.message?.content || channel.last_message
                      };
                    }
                    return channel;
                  });

                  // ✅ So'nggi xabar bo'yicha tartiblash
                  updatedChannels.sort((a, b) => {
                    const dateA = new Date(a.timestamp).getTime();
                    const dateB = new Date(b.timestamp).getTime();
                    return dateB - dateA;
                  });

                  return updatedChannels;
                });
              }
              break;

            case "unread_count":
              setChannels(prev => prev.map(channel => {
                if (channel.id.toString() === channelId) {
                  return { ...channel, unread: data.count };
                }
                return channel;
              }));
              break;
          }
        }
      }

      channelWs.onclose = () => {
        channelConnectionsRef.current.delete(channelId)
        setTimeout(() => {
          if (currentUser && !channelConnectionsRef.current.has(channelId)) {
            initializeChannelBackgroundListener(channelId)
          }
        }, 3000)
      }

      channelConnectionsRef.current.set(channelId, channelWs)
    } catch (error) {
      console.error("[Chat] Failed to initialize channel background listener:", error)
    }
  }, [currentUser])


  // Kanalga ulanish
  const connectToChannel = useCallback((channelId: string) => {
    if (currentChannelRef.current === channelId && channelWsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    if (channelWsRef.current) {
      channelWsRef.current.close()
    }

    try {
      const channelWs = new WebSocket(apiClient.getChannelWebSocketUrl(channelId))

      channelWs.onopen = () => {
        console.log(`[Chat] Channel WebSocket connected to channel ${channelId}`)
        currentChannelRef.current = channelId

        channelWs.send(JSON.stringify({
          action: "get_history"
        }))

        channelWs.send(JSON.stringify({
          action: "get_unread_count"
        }))
      }

      channelWs.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log("[Chat] Channel message received:", data)

        switch (data.type) {
          case "message_history":
            if (data.messages) {
              const roomKey = `channel_${channelId}`
              const formattedMessages = data.messages.map((msg: any) => ({
                id: msg.id,
                message: msg.content || "",
                sender: msg.user?.fullname || msg.user?.email || "User",
                timestamp: msg.created_at,
                isOwn: msg.is_own || msg.user?.id === currentUser?.id,
                is_own: msg.is_own || msg.user?.id === currentUser?.id,
                is_read: msg.is_read,
                is_channel_owner: msg.is_channel_owner,
                can_edit: msg.can_edit,
                can_delete: msg.can_delete,
                is_updated: msg.is_updated,
                message_type: msg.message_type || 'text',
                file_name: msg.file?.name,
                file_url: msg.file?.url,
                file_type: msg.file?.type,
                file_size: msg.file?.size,
                user: msg.user
              }))
              setMessages(prev => ({
                ...prev,
                [roomKey]: formattedMessages
              }))
            }
            break

          case "message_updated":
            setMessages(prev => {
              const roomKey = `channel_${channelId}`;
              const updatedMessages = (prev[roomKey] || []).map(msg => {
                if (msg.id === data.message_id.toString()) {
                  return {
                    ...msg,
                    message: data.new_content,
                    is_updated: true
                  };
                }
                return msg;
              });

              return {
                ...prev,
                [roomKey]: updatedMessages,
              };
            });
            break;

          case "message_deleted":
            setMessages(prev => {
              const roomKey = `channel_${channelId}`;
              const updatedMessages = (prev[roomKey] || []).filter(
                msg => msg.id !== data.message_id.toString()
              );

              return {
                ...prev,
                [roomKey]: updatedMessages,
              };
            });
            break;


          case "chat_message":
            const msgUserId = data.message?.user?.id || data.message?.user_id;
            const isCurrentUserMessage = msgUserId === currentUser?.id?.toString() ||
              msgUserId === currentUser?.id;

            let isChannelOwner = data.message?.is_channel_owner;
            if (isChannelOwner === undefined && isCurrentUserMessage) {
              isChannelOwner = true;
            } else if (isChannelOwner === undefined) {
              isChannelOwner = false;
            }

            const newMessage: Message = {
              id: data.message?.id?.toString() || `temp-${Date.now()}`,
              channel_id: parseInt(channelId),
              sender: data.message.user,
              message: data.message.content || "",
              timestamp: data.message.created_at,
              isOwn: data.message.is_own !== undefined ? data.message.is_own : isCurrentUserMessage,
              is_read: data.message.is_read,
              is_updated: data.message.is_updated,
              type: data.message.message_type || "text",
              file_name: data.message.file?.name,
              file_url: data.message.file?.url,
              file_type: data.message.file?.type,
              file_size: data.message.file?.size?.toString(),
              is_channel_owner: isChannelOwner,
              can_edit: data.message.can_edit !== undefined ? data.message.can_edit : isChannelOwner,
              can_delete: data.message.can_delete !== undefined ? data.message.can_delete : isChannelOwner,
            }

            addMessage(`channel_${channelId}`, newMessage)
            break;

          case "file_uploaded":
            const fileMessage: Message = {
              id: data.message?.id?.toString() || `temp-${Date.now()}`,
              channel_id: parseInt(channelId),
              sender: data.message.user,
              message: data.message.content || "",
              timestamp: data.message.created_at,
              isOwn: data.message.user.id === currentUser?.id?.toString(),
              is_read: data.message.is_read,
              is_updated: data.message.is_updated,
              type: "file",
              file_name: data.file_info?.name,
              file_url: data.file_info?.url,
              file_type: data.file_info?.type,
              file_size: data.file_info?.size?.toString(),
              can_edit: false,
              can_delete: false,
              is_channel_owner: false
            }

            addMessage(`channel_${channelId}`, fileMessage)
            break;

          case "file_deleted":
            setMessages(prev => {
              const roomKey = `channel_${channelId}`;
              const updatedMessages = (prev[roomKey] || []).filter(
                msg => msg.id !== data.file_id.toString()
              );

              return {
                ...prev,
                [roomKey]: updatedMessages,
              };
            });
            break;

          case "unread_count":
            setChannels(prev => prev.map(channel => {
              if (channel.id.toString() === channelId) {
                return { ...channel, unread: data.count };
              }
              return channel;
            }));
            break;

          case "message_read":
            setMessages(prev => {
              const roomKey = `channel_${channelId}`;
              const updatedMessages = (prev[roomKey] || []).map(msg => {
                if (msg.id === data.message_id.toString()) {
                  return { ...msg, is_read: true };
                }
                return msg;
              });

              return {
                ...prev,
                [roomKey]: updatedMessages,
              };
            });

            setChannels(prev => prev.map(channel => {
              if (channel.id.toString() === channelId) {
                return { ...channel, unread: data.unread_count };
              }
              return channel;
            }));
            break;

          case "message_read_update":
            // ✅ Xabar o'qilgan deb yangilash
            if (data.message_id) {
              const roomKey = `channel_${channelId}`
              setMessages(prev => ({
                ...prev,
                [roomKey]: (prev[roomKey] || []).map(msg =>
                  msg.id === data.message_id
                    ? { ...msg, is_read: true }
                    : msg
                )
              }))
            }
            break
        }
      }

      channelWs.onclose = () => {
        console.log(`[Chat] Channel WebSocket disconnected from channel ${channelId}`)
        currentChannelRef.current = null
      }

      channelWs.onerror = (error) => {
        console.error("[Chat] Channel WebSocket error:", error)
      }

      channelWsRef.current = channelWs
    } catch (error) {
      console.error("[Chat] Failed to connect to channel:", error)
    }
  }, [currentUser])

  // Kanal xabari yuborish
  const sendChannelMessage = useCallback((channelId: string, content: string) => {
    if (!channelWsRef.current || channelWsRef.current.readyState !== WebSocket.OPEN || !content.trim() || !channelId) {
      return
    }

    channelWsRef.current.send(JSON.stringify({
      action: "send_message",
      message: content.trim(),
      message_type: "text"
    }))
  }, [])

  // Kanal fayli yuborish
  const sendChannelFile = useCallback((channelId: string, fileData: string, fileName: string, fileType: string) => {
    if (!channelWsRef.current || channelWsRef.current.readyState !== WebSocket.OPEN || !channelId) {
      return
    }

    channelWsRef.current.send(JSON.stringify({
      action: "upload_file",
      file_data: fileData,
      file_name: fileName,
      file_type: fileType
    }))
  }, [])

  const markChannelMessageAsRead = useCallback((_channelId: string, messageId: string) => {
    if (channelWsRef.current && channelWsRef.current.readyState === WebSocket.OPEN) {
      channelWsRef.current.send(JSON.stringify({
        action: "mark_as_read",
        message_id: messageId
      }))
    }
  }, [])

  const createChannel = useCallback(async (name: string, username: string, description?: string,) => {
    try {
      const response = await apiClient.createChannel({
        name,
        description,
        username,
        owner: currentUser.id
      })
      await loadChannels()
      return response
    } catch (error) {
      console.error("[Chat] Failed to create channel:", error)
      throw error
    }
  }, [currentUser])

  // use-chat.txt - loadChannels funksiyasining oxirida

  const loadChannels = useCallback(async () => {
    try {
      const channelsData = await apiClient.getChannels()

      const formattedChannels: Chat[] = channelsData.map((channel: any) => {

        return {
          id: channel.id,
          name: channel.name,
          sender: channel.owner_name || "Noma'lum",
          sender_id: channel.owner,
          last_message: channel.last_message || "",
          timestamp: channel.timestamp || channel.updated_at,
          unread: 0,
          avatar: "/channel-avatar.png",
          message_type: "text",
          room_id: `channel_${channel.id}`,
          type: "channel",
          description: channel.description,
          memberCount: channel.member_count || 0,
          isAdmin: channel.isOwner || channel.owner === currentUser?.id,
          isOwner: channel.isOwner || channel.owner === currentUser?.id,
          // ✅ is_subscribed ni to'g'ri o'rnatish
          isSubscribed: channel.is_subscribed === true,
          username: channel.username
        }
      })

      // ✅ So'nggi faollik bo'yicha tartiblash
      formattedChannels.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()
        return dateB - dateA // Yangi xabarlar yuqorida
      })

      setChannels(formattedChannels)

      // Background listeners
      formattedChannels.forEach(channel => {
        if (channel.isSubscribed) {
          initializeChannelBackgroundListener(channel.id.toString())
        }
      })
    } catch (error) {
      console.error("[Chat] Failed to load channels:", error)
    }
  }, [currentUser])



  return {
    chats,
    groups,
    channels,
    messages,
    apiClient,
    chatWsRef,
    groupWsRef,
    isConnected,
    currentUser,
    channelWsRef,
    setChats,
    setGroups,
    loadGroups,
    markAsRead,
    setChannels,
    setMessages,
    sendMessage,
    createGroup,
    loadChannels,
    createChannel,
    sendGroupFile,
    updateMessage,
    removeMessage,
    setCurrentUser,
    connectToGroup,
    addGroupMember,
    getGroupMembers,
    sendChannelFile,
    sendGroupMessage,
    connectToChannel,
    connectToChatRoom,
    sendChannelMessage,
    getGroupUnreadCount,
    updateChatUnreadCount,
    markGroupMessageAsRead,
    markChannelMessageAsRead,
    updateCurrentUserProfile,
  }
}