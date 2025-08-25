"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Paperclip, Search, MoreVertical, FileText, ImageIcon, Download } from "lucide-react"

interface Message {
  id: number
  sender: string
  content: string
  timestamp: string
  isOwn: boolean
  type: "text" | "file"
  fileName?: string
  fileType?: string
}

interface Contact {
  id: number
  name: string
  lastMessage: string
  timestamp: string
  unread: number
  online: boolean
}

export default function ChatPage() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [message, setMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const contacts: Contact[] = [
    {
      id: 1,
      name: "John Smith",
      lastMessage: "Thanks for the update...",
      timestamp: "2 min ago",
      unread: 2,
      online: true,
    },
    {
      id: 2,
      name: "Sarah Johnson",
      lastMessage: "Can we schedule a meeting?",
      timestamp: "1 hour ago",
      unread: 0,
      online: true,
    },
    {
      id: 3,
      name: "Mike Davis",
      lastMessage: "Report submitted successfully",
      timestamp: "3 hours ago",
      unread: 1,
      online: false,
    },
    {
      id: 4,
      name: "Emily Wilson",
      lastMessage: "Great work on the presentation",
      timestamp: "1 day ago",
      unread: 0,
      online: false,
    },
    {
      id: 5,
      name: "David Brown",
      lastMessage: "Let me know if you need help",
      timestamp: "2 days ago",
      unread: 0,
      online: true,
    },
  ]

  const messages: Message[] = [
    {
      id: 1,
      sender: "John Smith",
      content: "Hi there! How are you doing today?",
      timestamp: "10:30 AM",
      isOwn: false,
      type: "text",
    },
    {
      id: 2,
      sender: "You",
      content: "Hello John! I'm doing well, thanks for asking. How about you?",
      timestamp: "10:32 AM",
      isOwn: true,
      type: "text",
    },
    {
      id: 3,
      sender: "John Smith",
      content: "I'm great! I wanted to share the latest project report with you.",
      timestamp: "10:33 AM",
      isOwn: false,
      type: "text",
    },
    {
      id: 4,
      sender: "John Smith",
      content: "Project_Report_Q4.pdf",
      timestamp: "10:34 AM",
      isOwn: false,
      type: "file",
      fileName: "Project_Report_Q4.pdf",
      fileType: "pdf",
    },
    {
      id: 5,
      sender: "You",
      content: "Thanks for sharing! I'll review it and get back to you with feedback.",
      timestamp: "10:35 AM",
      isOwn: true,
      type: "text",
    },
    {
      id: 6,
      sender: "John Smith",
      content: "Perfect! Take your time. Let me know if you have any questions.",
      timestamp: "10:36 AM",
      isOwn: false,
      type: "text",
    },
  ]

  const filteredContacts = contacts.filter((contact) => contact.name.toLowerCase().includes(searchTerm.toLowerCase()))

  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      setSelectedContact(contacts[0])
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real app, this would send the message to the backend
      console.log("Sending message:", message)
      setMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return <FileText className="w-4 h-4 text-red-600" />
      case "image":
        return <ImageIcon className="w-4 h-4 text-blue-600" />
      default:
        return <FileText className="w-4 h-4 text-slate-600" />
    }
  }

  return (
    <MainLayout>
      <div className="flex h-full">
        {/* Contacts Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${
                  selectedContact?.id === contact.id ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    {contact.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 truncate">{contact.name}</p>
                      <span className="text-xs text-slate-500">{contact.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-slate-600 truncate">{contact.lastMessage}</p>
                      {contact.unread > 0 && (
                        <Badge className="bg-blue-600 text-white text-xs px-2 py-1 ml-2">{contact.unread}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {selectedContact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-medium text-slate-800">{selectedContact.name}</h2>
                      <p className="text-sm text-slate-500">
                        {selectedContact.online ? "Online" : "Last seen 2 hours ago"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs lg:max-w-md ${msg.isOwn ? "order-2" : "order-1"}`}>
                      {msg.type === "text" ? (
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            msg.isOwn ? "bg-blue-600 text-white" : "bg-white text-slate-800 border border-slate-200"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      ) : (
                        <Card className={`${msg.isOwn ? "bg-blue-50 border-blue-200" : ""}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center space-x-3">
                              {getFileIcon(msg.fileType || "file")}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{msg.fileName}</p>
                                <p className="text-xs text-slate-500">PDF Document</p>
                              </div>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      <p className={`text-xs text-slate-500 mt-1 ${msg.isOwn ? "text-right" : "text-left"}`}>
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="bg-white border-t border-slate-200 p-4">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
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
  )
}
