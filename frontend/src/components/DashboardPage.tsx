import { useState, useEffect, useRef } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Users, FileText, Plus, Clock, Shield } from "lucide-react"
import { Link } from "react-router-dom"

interface User {
  fullname: string
  username: string
  email: string
}

interface Conversation {
  id: number
  sender: string
  sender_id: number
  last_message: string
  timestamp: string
  unread: number
  message_type?: string
}

interface FileItem {
  id: number
  name: string
  type: string
  size: string
  uploadedBy: string
  uploadDate: string
  downloadCount: number
  isOwner: boolean
  roomId?: number
  fileUrl: string
  fileName: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notificationSocket, setNotificationSocket] = useState<WebSocket | null>(null)
  const [filesSocket, setFilesSocket] = useState<WebSocket | null>(null)
  const reconnectAttempts = useRef({ notifications: 0, files: 0 })

  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const refresh = localStorage.getItem("refresh_token");
      if (!refresh) {
        console.log("❌ Refresh token topilmadi");
        localStorage.clear();
        window.location.href = "/login";
        return null;
      }

      const response = await fetch("http://127.0.0.1:8000/api/token/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      // Handle non-200 responses
      if (!response.ok) {
        throw new Error(`Token refresh failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (data.access) {
        localStorage.setItem("access_token", data.access);
        console.log("✅ Access token yangilandi");
        return data.access;
      } else {
        console.log("❌ Refresh token ham tugagan");
        localStorage.clear();
        window.location.href = "/login";
        return null;
      }
    } catch (error) {
      console.error("Refresh error:", error);
      localStorage.clear();
      window.location.href = "/login";
      return null;
    }
  };

  const connectToFiles = async () => {
    let token = localStorage.getItem("access_token");

    if (!token) {
      token = await refreshAccessToken();
      if (!token) return;
    }

    try {
      // Close existing connection if any
      if (filesSocket) {
        filesSocket.close();
      }

      const newFilesSocket = new WebSocket(`ws://127.0.0.1:8000/ws/files/?token=${token}`)

      newFilesSocket.onopen = () => {
        console.log("✅ Files WebSocket connected")
        reconnectAttempts.current.files = 0;
        newFilesSocket.send(JSON.stringify({
          action: "get_files"
        }))
      }

      newFilesSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "file_list") {
            setFiles(data.files || [])
          }
          
          // Handle 401 errors from server
          if (data.error && data.code === 401) {
            console.log("❌ 401 error received from files WebSocket");
            handleUnauthorizedError('files');
          }
        } catch (error) {
          console.error("Files WebSocket message parsing error:", error)
        }
      }

      newFilesSocket.onclose = (event) => {
        console.log("❌ Files WebSocket disconnected", event.code, event.reason)

        // Don't reconnect if closed normally
        if (event.code !== 1000 && event.code !== 1001) {
          const delay = Math.min(30000, (2 ** reconnectAttempts.current.files) * 1000);
          console.log(`🔄 Reconnecting Files WebSocket in ${delay/1000} seconds...`)
          
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              reconnectAttempts.current.files++;
              connectToFiles();
            }
          }, delay);
        }
      }

      newFilesSocket.onerror = (error) => {
        console.error("Files WebSocket error:", error)
      }

      setFilesSocket(newFilesSocket);
    } catch (error) {
      console.error("Files WebSocket connection error:", error)
    }
  }

  const connectToNotifications = async () => {
    let token = localStorage.getItem("access_token");

    if (!token) {
      token = await refreshAccessToken();
      if (!token) return;
    }

    try {
      // Close existing connection if any
      if (notificationSocket) {
        notificationSocket.close();
      }

      const newNotificationSocket = new WebSocket(`ws://127.0.0.1:8000/ws/notifications/?token=${token}`)

      newNotificationSocket.onopen = () => {
        console.log("✅ Notification WebSocket connected")
        reconnectAttempts.current.notifications = 0;
        setLoading(false)

        newNotificationSocket.send(JSON.stringify({
          action: "get_recent_conversations"
        }))
      }

      newNotificationSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "recent_conversations") {
            setRecentConversations(data.conversations || [])
          }

          if (data.type === "new_message") {
            setRecentConversations((prev) => {
              const existing = prev.find((c) => c.id === data.chat_id)

              if (existing) {
                return [
                  {
                    ...existing,
                    last_message: data.message,
                    timestamp: data.timestamp,
                    unread: existing.unread + 1,
                  },
                  ...prev.filter((c) => c.id !== data.chat_id),
                ]
              } else {
                return [
                  {
                    id: data.chat_id,
                    sender: data.sender_name,
                    sender_id: data.sender_id,
                    last_message: data.message,
                    timestamp: data.timestamp,
                    unread: 1,
                    message_type: "text"
                  },
                  ...prev,
                ].slice(0, 3)
              }
            })
          }

          if (data.type === "unread_count_update") {
            setRecentConversations((prev) =>
              prev.map((conv) =>
                conv.sender_id === data.contact_id
                  ? { ...conv, unread: data.unread_count }
                  : conv
              )
            )
          }
          
          // Handle 401 errors from server
          if (data.error && data.code === 401) {
            console.log("❌ 401 error received from notifications WebSocket");
            handleUnauthorizedError('notifications');
          }
        } catch (error) {
          console.error("WebSocket message parsing error:", error)
        }
      }

      newNotificationSocket.onclose = (event) => {
        console.log("❌ Notification WebSocket disconnected", event.code, event.reason)

        // Don't reconnect if closed normally
        if (event.code !== 1000 && event.code !== 1001) {
          const delay = Math.min(30000, (2 ** reconnectAttempts.current.notifications) * 1000);
          console.log(`🔄 Reconnecting Notification WebSocket in ${delay/1000} seconds...`)
          
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              reconnectAttempts.current.notifications++;
              connectToNotifications();
            }
          }, delay);
        }
      }

      newNotificationSocket.onerror = (error) => {
        console.error("WebSocket error:", error)
        setLoading(false)
      }

      setNotificationSocket(newNotificationSocket);
    } catch (error) {
      console.error("WebSocket connection error:", error)
      setLoading(false)
    }
  }

  const handleUnauthorizedError = async (socketType: 'notifications' | 'files') => {
    console.log(`🔄 Handling 401 error for ${socketType} WebSocket`);
    
    // Try to refresh the token
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Token refreshed successfully, reconnect the WebSocket
      if (socketType === 'notifications') {
        connectToNotifications();
      } else {
        connectToFiles();
      }
    }
    // If refreshAccessToken fails, it will redirect to login
  }

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user")
      if (userData && userData !== "undefined") {
        setUser(JSON.parse(userData))
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("Failed to parse user data:", error)
      setUser(null)
    }
  }, [])

  useEffect(() => {
    connectToFiles();
    
    return () => {
      if (filesSocket) {
        filesSocket.close();
      }
    }
  }, [])

  useEffect(() => {
    connectToNotifications();
    
    return () => {
      if (notificationSocket) {
        notificationSocket.close();
      }
    }
  }, [])

  const stats = [
    { title: "Active Conversations", value: recentConversations.length.toString(), icon: MessageCircle, color: "text-blue-600" },
    { title: "Unread Messages", value: recentConversations.reduce((sum, conv) => sum + conv.unread, 0).toString(), icon: Users, color: "text-green-600" },
    { title: "Total Files", value: files.length.toString(), icon: FileText, color: "text-purple-600" },
  ]

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffInMinutes < 1) return "Now";
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">
                Welcome back, {user?.fullname || "User"}!
              </h1>
              <p className="text-slate-600 mt-1">
                Here's what's happening in your secure communication platform today.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-600" />
              <Badge variant="outline" className="text-green-600 border-green-200">
                Secure Connection
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <Card key={index} className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                    <p className="text-2xl font-semibold text-slate-800 mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent Conversations</CardTitle>
                  <CardDescription>Your latest message exchanges</CardDescription>
                </div>
                <Link to="/chat">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    New Chat
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  Loading conversations...
                </div>
              ) : recentConversations.length > 0 ? (
                recentConversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    to={`/chat/`}
                    className="block"
                  >
                    <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {conversation.sender
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800">
                            {conversation.sender}
                          </p>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTimestamp(conversation.timestamp)}
                            </span>
                            {conversation.unread > 0 && (
                              <Badge className="bg-blue-600 text-white text-xs px-2 py-1">
                                {conversation.unread}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 truncate">
                          {conversation.message_type === "file" ? "📎 " : ""}{conversation.last_message}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No recent conversations</p>
                  <p className="text-xs mt-1">Start a new chat to see conversations here</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/chat">
                <Button variant="outline" className="w-full justify-start bg-transparent hover:bg-slate-50">
                  <MessageCircle className="w-4 h-4 mr-3" />
                  Start New Conversation
                </Button>
              </Link>
              <Link to="/files">
                <Button variant="outline" className="w-full justify-start bg-transparent hover:bg-slate-50">
                  <FileText className="w-4 h-4 mr-3" />
                  Upload File
                </Button>
              </Link>
              <Link to="/profile">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Shield className="w-4 h-4 mr-3" />
                  Security Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  )
}