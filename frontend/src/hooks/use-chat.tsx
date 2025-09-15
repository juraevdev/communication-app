import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient } from "@/lib/api"

export interface Message {
  id: string
  room_id?: number
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
}

export function useChat() {
  const [messages, setMessages] = useState<{ [roomId: string]: Message[] }>({})
  const [chats, setChats] = useState<Chat[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const statusWsRef = useRef<WebSocket | null>(null)
  const chatWsRef = useRef<WebSocket | null>(null)
  const notificationsWsRef = useRef<WebSocket | null>(null)
  const currentRoomRef = useRef<string | null>(null)

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const user = await apiClient.getMe()
        setCurrentUser(user)
        console.log("[Chat] Current user loaded:", user)

        initializeStatusWebSocket()
        initializeNotificationsWebSocket()
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
      if (notificationsWsRef.current) {
        notificationsWsRef.current.close()
      }
    }
  }, [])

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
                }

                addMessage(roomId, newMessage)
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
                }

                addMessage(roomId, fileMessage)
              }
              break

            case "message_updated":
              updateMessage(roomId, data.message_id, data.new_content)
              break

            case "message_deleted":
              removeMessage(roomId, data.message_id)
              break

            case "file_deleted":
              removeMessage(roomId, data.file_id)
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

              if (!data.success) {
                console.error("Failed to mark message as read on server");
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

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      if (!chatWsRef.current || chatWsRef.current.readyState !== WebSocket.OPEN || !content.trim()) {
        console.log("[Chat] Cannot send message: WebSocket not ready or empty content")
        return
      }

      chatWsRef.current.send(
        JSON.stringify({
          action: "send",
          message: content.trim(),
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
    }
  },
  [],
);



  const addMessage = useCallback((roomId: string, message: Message) => {
    setMessages((prev) => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), message],
    }))
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

  const markMessageAsRead = useCallback((roomId: string, messageId: string) => {
    setMessages((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] || []).map((msg) =>
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ),
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

  return {
    messages,
    chats,
    isConnected,
    currentUser,
    sendMessage,
    markAsRead,
    connectToChatRoom,
    apiClient,
    chatWsRef,
  }
}