import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient } from "@/lib/api"

export interface Message {
  id: string
  room_id?: number
  group_id?: number
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

export interface GroupMember {
  id: number
  user: number
  user_fullname: string
  user_username: string
  role: "owner" | "admin" | "member"
  joined_at: string
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
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set())

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const user = await apiClient.getMe()
        setCurrentUser(user)
        console.log("[Chat] Current user loaded:", user)

        initializeStatusWebSocket()
        initializeNotificationsWebSocket()
        await loadGroups()
      } catch (error) {
        console.error("[Chat] Failed to load user:", error)
        window.location.href = "/login"
      }
    }

    initializeUser()

    return () => {
      if (statusWsRef.current) {
        statusWsRef.current.close()
      }
      if (chatWsRef.current) {
        chatWsRef.current.close()
      }
      if (groupWsRef.current) {
        groupWsRef.current.close()
      }
      if (notificationsWsRef.current) {
        notificationsWsRef.current.close()
      }
    }
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const groupsData = await apiClient.getGroups()
      const formattedGroups: Chat[] = groupsData.map((group: any) => ({
        id: group.id,
        name: group.name,
        sender: group.name,
        sender_id: group.created_by,
        last_message: "",
        timestamp: group.updated_at,
        unread: 0,
        avatar: "/group-avatar.png",
        message_type: "text",
        room_id: `group_${group.id}`,
        type: "group",
        description: group.description,
        memberCount: 0,
        isAdmin: group.created_by === currentUser?.id,
      }))
      setGroups(formattedGroups)
    } catch (error) {
      console.error("[Chat] Failed to load groups:", error)
    }
  }, [currentUser])

  const initializeStatusWebSocket = useCallback(() => {
    try {
      const statusWs = new WebSocket(apiClient.getStatusWebSocketUrl())

      statusWs.onopen = () => {
        console.log("[Chat] Status WebSocket connected")
        setIsConnected(true)
      }

      statusWs.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log("[Chat] Status update received:", data)

        if (data.type === "status_update") {
          updateUserOnlineStatus(data.user_id, data.status === "online")
        }
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
              }))
              setChats(formattedChats)
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
                }

                addMessage(roomId, fileMessage)

                if (!fileMessage.isOwn && currentRoomRef.current === roomId) {
                  setTimeout(() => {
                    markAsRead(roomId, undefined, fileMessage.id)
                  }, 500)
                }
              }
              break

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

              if (data.room_id) {
                setChats(prev => prev.map(chat => {
                  const chatRoomId = chat.room_id || chat.id?.toString();
                  if (chatRoomId === data.room_id.toString()) {
                    if (data.unread_count !== undefined) {
                      return { ...chat, unread: data.unread_count };
                    } else {
                      return { ...chat, unread: Math.max(0, chat.unread - 1) };
                    }
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
                    id: msg.sender?.toString() || msg.sender_id?.toString(),
                    email: "",
                    fullname: msg.sender_fullname || "Unknown",
                    full_name: msg.sender_fullname || "Unknown",
                  },
                  message: msg.content || msg.message || "",
                  timestamp: msg.created_at || msg.timestamp || new Date().toISOString(),
                  isOwn: (msg.sender?.toString() === currentUser?.id?.toString()) ||
                    (msg.sender_id?.toString() === currentUser?.id?.toString()),
                  is_read: true,
                  is_updated: msg.is_updated || false,
                  type: "text",
                  reply_to: msg.reply_to,
                }))

                formattedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

                setMessages((prev) => ({
                  ...prev,
                  [`group_${groupId}`]: formattedMessages,
                }))
              }
              break

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
                is_read: true,
                is_updated: false,
                type: "text",
                reply_to: data.reply_to,
              }

              console.log("[Chat] New group message received:", newMessage)
              addMessage(`group_${groupId}`, newMessage)
              break

            case "typing":
              setTypingUsers(prev => {
                const newTypingUsers = new Set(prev)
                newTypingUsers.add(data.user_id)
                return newTypingUsers
              })
              break


            case "stop_typing":
              setTypingUsers(prev => {
                const newTypingUsers = new Set(prev)
                newTypingUsers.delete(data.user_id)
                return newTypingUsers
              })
              break

            case "member_joined":
              console.log("Member joined:", data.user)
              break

            case "member_left":
              console.log("Member left:", data.user_name)
              break

            case "role_updated":
              console.log("Role updated:", data)
              break
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

  const markAsRead = useCallback(
    (roomId: string, messageId?: string, fileId?: string) => {
      if (chatWsRef.current && chatWsRef.current.readyState === WebSocket.OPEN) {
        console.log("[Chat] Marking as read:", { messageId, fileId });

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

        setChats(prev => prev.map(chat => {
          const chatRoomId = chat.room_id || chat.id?.toString();
          if (chatRoomId === roomId && chat.unread > 0) {
            return { ...chat, unread: Math.max(0, chat.unread - 1) };
          }
          return chat;
        }));
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

  const updateUserOnlineStatus = useCallback((userId: number, isOnline: boolean) => {
    console.log(`[Chat] User ${userId} is now ${isOnline ? 'online' : 'offline'}`)
  }, [])

  // Group-specific functions
  const createGroup = useCallback(async (name: string, description?: string) => {
    try {
      const response = await apiClient.createGroup({
        name,
        description,
        created_by: currentUser.id
      })
      await loadGroups() // Reload groups
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

  return {
    messages,
    chats,
    groups,
    isConnected,
    currentUser,
    sendMessage,
    sendGroupMessage,
    markAsRead,
    connectToChatRoom,
    connectToGroup,
    createGroup,
    addGroupMember,
    getGroupMembers,
    loadGroups,
    apiClient,
    chatWsRef,
    groupWsRef,
  }
}