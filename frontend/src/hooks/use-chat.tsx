import { useState, useEffect, useCallback, useRef } from "react"
import { apiClient } from "@/lib/api"

export interface Message {
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
  status?: any
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

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const user = await apiClient.getMe()
        setCurrentUser(user)
        console.log("[Chat] Current user loaded:", user)

        initializeStatusWebSocket()
        initializeNotificationsWebSocket()
        await loadGroups()
        await loadChannels()
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
      groupConnectionsRef.current.forEach(ws => ws.close())
      groupConnectionsRef.current.clear()
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
      }

      groupWs.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (currentGroupRef.current !== groupId) {
          switch (data.type) {
            case "chat_message":
            case "file_uploaded":
              if (data.sender_id !== currentUser?.id) {
                setGroups(prev => prev.map(group => {
                  if (group.id.toString() === groupId) {
                    return { ...group, unread: (group.unread || 0) + 1 };
                  }
                  return group;
                }));
              }
              break;

            case "new_message_notification":
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
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
              break;

            default:
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

      groupWs.onerror = (error) => {
      }

      groupConnectionsRef.current.set(groupId, groupWs)
    } catch (error) {
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

          groupWs.send(JSON.stringify({
            type: "mark_all_as_read"
          }))
        }

        groupWs.onmessage = (event) => {
          const data = JSON.parse(event.data)
          console.log("[Chat] Group message received:", data)

          switch (data.type) {

            case "message_history":
              if (data.messages && Array.isArray(data.messages)) {

                const formattedMessages: Message[] = data.messages.map((msg: any) => {

                  return {
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
                    reply_to: msg.reply_to,
                  }
                })

                console.log("[DEBUG] Formatted messages:", formattedMessages);

                formattedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

                setMessages((prev) => ({
                  ...prev,
                  [`group_${groupId}`]: formattedMessages,
                }))
              }
              break

            case 'message_read_confirmed':
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
              break;

            case 'read':
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
                reply_to: data.reply_to,
                file_name: data.file_name,
                file_url: data.file_url,
                file_type: data.file_type,
                file_size: data.file_size?.toString(),
              }

              console.log("[Chat] New group message received:", newMessage)

              setMessages(prev => {
                const roomKey = `group_${groupId}`;
                const currentMessages = prev[roomKey] || [];

                if (currentMessages.some(msg => msg.id === newMessage.id)) {
                  return prev;
                }

                const updatedMessages = [...currentMessages, newMessage];
                updatedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                return {
                  ...prev,
                  [roomKey]: updatedMessages,
                };
              });
              break;

            case "file_uploaded":
              if (data.id) {
                const fileMessage: Message = {
                  id: data.id.toString(),
                  group_id: parseInt(groupId),
                  sender: {
                    id: data.user?.id?.toString() || data.sender_id?.toString(),
                    email: "",
                    fullname: data.user?.fullname || data.sender_name || "Unknown",
                    full_name: data.user?.fullname || data.sender_name || "Unknown",
                  },
                  message: data.file_name || "File",
                  timestamp: data.uploaded_at || data.timestamp || new Date().toISOString(),
                  isOwn: (data.user?.id || data.sender_id) === currentUser?.id,
                  is_read: (data.user?.id || data.sender_id) === currentUser?.id,
                  is_updated: false,
                  type: "file",
                  file_name: data.file_name,
                  file_url: data.file_url,
                  file_type: data.file_type || "file",
                  file_size: data.file_size?.toString(),
                }

                console.log("[Chat] New group file message received:", fileMessage)

                addMessage(`group_${groupId}`, fileMessage)
              }
              break;

            case 'new_message_notification':
              if (data.sender_id !== currentUser?.id) {
                if (currentGroupRef.current !== groupId) {
                  setGroups(prev => prev.map(group => {
                    if (group.id.toString() === groupId) {
                      return { ...group, unread: (group.unread || 0) + 1 };
                    }
                    return group;
                  }));
                }
              }
              break;

            case 'initial_unread_count':
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
              break;

            case 'unread_count_increment':
              if (currentGroupRef.current !== groupId) {
                setGroups(prev => prev.map(group => {
                  if (group.id.toString() === groupId) {
                    return { ...group, unread: (group.unread || 0) + data.count };
                  }
                  return group;
                }));
              }
              break;

            case 'unread_count_decrement':
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: Math.max(0, (group.unread || 0) - data.count) };
                }
                return group;
              }));
              break;

            case 'unread_count':
              setGroups(prev => prev.map(group => {
                if (group.id.toString() === groupId) {
                  return { ...group, unread: data.count };
                }
                return group;
              }));
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
    groupId: string,
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
      groupWsRef.current.send(JSON.stringify({
        type: "mark_as_read",
        message_id: messageId
      }));

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

      setGroups(prev => prev.map(group => {
        if (group.id.toString() === groupId && group.unread > 0) {
          return { ...group, unread: Math.max(0, group.unread - 1) };
        }
        return group;
      }));
    }
  }, []);

  const getGroupUnreadCount = useCallback((groupId: string) => {
    if (groupWsRef.current && groupWsRef.current.readyState === WebSocket.OPEN) {
      groupWsRef.current.send(JSON.stringify({
        type: "get_unread_count"
      }));
    }
  }, []);

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

      channelWs.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (currentChannelRef.current !== channelId) {
          switch (data.type) {
            case "chat_message":
            case "file_uploaded":
              if (data.message?.user?.id !== currentUser?.id?.toString()) {
                setChannels(prev => prev.map(channel => {
                  if (channel.id.toString() === channelId) {
                    return { ...channel, unread: (channel.unread || 0) + 1 };
                  }
                  return channel;
                }));
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
            if (data.messages && Array.isArray(data.messages)) {
              const formattedMessages: Message[] = data.messages.map((msg: any) => ({
                id: msg.id.toString(),
                channel_id: parseInt(channelId),
                sender: {
                  id: msg.user.id,
                  email: "",
                  fullname: msg.user.fullname || "Unknown",
                  full_name: msg.user.fullname || "Unknown",
                },
                message: msg.content || "",
                timestamp: msg.created_at,
                isOwn: msg.user.id === currentUser?.id?.toString(),
                is_read: msg.is_read,
                is_updated: msg.is_updated,
                type: msg.message_type || "text",
                file_name: msg.file?.name,
                file_url: msg.file?.url,
                file_type: msg.file?.type,
                file_size: msg.file?.size?.toString(),
              })).reverse()

              setMessages(prev => ({
                ...prev,
                [`channel_${channelId}`]: formattedMessages,
              }))
            }
            break;

          case "chat_message":
            const newMessage: Message = {
              id: data.message?.id?.toString() || `temp-${Date.now()}`,
              channel_id: parseInt(channelId),
              sender: data.message.user,
              message: data.message.content || "",
              timestamp: data.message.created_at,
              isOwn: data.message.user.id === currentUser?.id?.toString(),
              is_read: data.message.is_read,
              is_updated: data.message.is_updated,
              type: data.message.message_type || "text",
              file_name: data.message.file?.name,
              file_url: data.message.file?.url,
              file_type: data.message.file?.type,
              file_size: data.message.file?.size?.toString(),
            }

            addMessage(`channel_${channelId}`, newMessage)

            if (data.unread_count !== undefined) {
              setChannels(prev => prev.map(channel => {
                if (channel.id.toString() === channelId) {
                  return { ...channel, unread: data.unread_count };
                }
                return channel;
              }));
            }
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
            }

            addMessage(`channel_${channelId}`, fileMessage)
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
    if (!channelWsRef.current || channelWsRef.current.readyState !== WebSocket.OPEN || !content.trim()) {
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
    if (!channelWsRef.current || channelWsRef.current.readyState !== WebSocket.OPEN) {
      return
    }

    channelWsRef.current.send(JSON.stringify({
      action: "upload_file",
      file_data: fileData,
      file_name: fileName,
      file_type: fileType
    }))
  }, [])

  // Kanal xabarini o'qilgan deb belgilash
  const markChannelMessageAsRead = useCallback((channelId: string, messageId: string) => {
    if (channelWsRef.current && channelWsRef.current.readyState === WebSocket.OPEN) {
      channelWsRef.current.send(JSON.stringify({
        action: "mark_as_read",
        message_id: messageId
      }))
    }
  }, [])

  // Kanal yaratish
  const createChannel = useCallback(async (name: string, description?: string) => {
    try {
      const response = await apiClient.createChannel({
        name,
        description,
        owner: currentUser.id
      })
      await loadChannels()
      return response
    } catch (error) {
      console.error("[Chat] Failed to create channel:", error)
      throw error
    }
  }, [currentUser])

  // Kanallarni yuklash
const loadChannels = useCallback(async () => {
  try {
    const channelsData = await apiClient.getChannels()
    const currentUserData = await apiClient.getMe() 
    
    const formattedChannels: Chat[] = channelsData.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      sender: channel.owner_name || "Unknown",
      sender_id: channel.owner,
      last_message: channel.last_message || "",
      timestamp: channel.updated_at,
      unread: channel.unread_count || 0,
      avatar: "/channel-avatar.png",
      message_type: "text",
      room_id: `channel_${channel.id}`,
      type: "channel",
      description: channel.description,
      memberCount: channel.member_count || 0,
      isAdmin: channel.owner === currentUserData?.id, 
      isOwner: channel.owner === currentUserData?.id, 
    }))
    setChannels(formattedChannels)
  } catch (error) {
    console.error("[Chat] Failed to load channels:", error)
  }
}, [currentUser])

  

  return {
    chats,
    groups,
    messages,
    apiClient,
    chatWsRef,
    groupWsRef,
    isConnected,
    currentUser,
    setGroups,
    loadGroups,
    markAsRead,
    sendMessage,
    createGroup,
    sendGroupFile,
    updateMessage,
    removeMessage,
    connectToGroup,
    addGroupMember,
    getGroupMembers,
    sendGroupMessage,
    connectToChatRoom,
    getGroupUnreadCount,
    updateChatUnreadCount,
    markGroupMessageAsRead,
    channels,
    channelWsRef,
    loadChannels,
    createChannel,
    connectToChannel,
    sendChannelMessage,
    sendChannelFile,
    markChannelMessageAsRead,
  }
}