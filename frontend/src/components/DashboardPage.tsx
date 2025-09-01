"use client"

import { useState, useEffect } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Users, FileText, Plus, Clock, Shield } from "lucide-react"
import { Link } from "react-router-dom"

interface User {
  email: string
  role: string
  name: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)

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
  }, []);
  
  


  const recentConversations = [
    { id: 1, name: "John Smith", lastMessage: "Thanks for the update on the project...", time: "2 min ago", unread: 2 },
    {
      id: 2,
      name: "Sarah Johnson",
      lastMessage: "Can we schedule a meeting for tomorrow?",
      time: "1 hour ago",
      unread: 0,
    },
    {
      id: 3,
      name: "Mike Davis",
      lastMessage: "The report has been submitted successfully.",
      time: "3 hours ago",
      unread: 1,
    },
  ]

  const stats = [
    { title: "Active Conversations", value: "12", icon: MessageCircle, color: "text-blue-600" },
    { title: "Team Members", value: "48", icon: Users, color: "text-green-600" },
    { title: "Shared Files", value: "156", icon: FileText, color: "text-purple-600" },
  ]

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Header */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Welcome back, {user?.name || "User"}!</h1>
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

        {/* Stats Cards */}
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
          {/* Recent Conversations */}
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
              {recentConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {conversation.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{conversation.name}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {conversation.time}
                        </span>
                        {conversation.unread > 0 && (
                          <Badge className="bg-blue-600 text-white text-xs px-2 py-1">{conversation.unread}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 truncate">{conversation.lastMessage}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
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

        {/* Admin Section */}
        {user?.role === "Admin" && (
          <Card className="border-slate-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg text-blue-800">Admin Dashboard</CardTitle>
              <CardDescription className="text-blue-600">Administrative tools and user management</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-slate-800 mb-2">User Management</h3>
                  <p className="text-sm text-slate-600 mb-3">Manage user accounts and permissions</p>
                  <Link to="/users">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                      View Users
                    </Button>
                  </Link>
                </div>
                <div className="bg-white p-4 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-slate-800 mb-2">System Status</h3>
                  <p className="text-sm text-slate-600 mb-3">Monitor platform health and security</p>
                  <Button size="sm" variant="outline">
                    View Status
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
