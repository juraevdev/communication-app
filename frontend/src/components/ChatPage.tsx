import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Paperclip, Search, MoreVertical, FileText, ImageIcon, Download } from "lucide-react";

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  type: "text" | "file";
  fileName?: string;
  fileType?: string;
}

interface Contact {
  id: number;
  name: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  online: boolean;
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem("user");
      
      if (!storedUser || storedUser === "undefined" || storedUser === "null") {
        console.warn("No valid user data found in localStorage");
        return "";
      }
      
      const parsedUser = JSON.parse(storedUser);
      
      console.log("Stored user object:", parsedUser);
      console.log("Stored user keys:", Object.keys(parsedUser));
      
      return parsedUser.fullname || 
             parsedUser.full_name || 
             parsedUser.username || 
             parsedUser.name || 
             parsedUser.email ||
             "";
    } catch (error) {
      console.error("Invalid user data in localStorage", error);
      return "";
    }
  };

  const currentUser = getCurrentUser();


  useEffect(() => {
    console.log("Current messages:", messages);
  }, [messages]);


  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get("http://127.0.0.1:8000/api/v1/accounts/contact/filter/", {
          params: { search: searchTerm },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          }
        });

        const data = response.data.map((user: any, index: number) => ({
          id: index + 1,
          name: user.alias,
          lastMessage: "",
          timestamp: "",
          unread: 0,
          online: false,
        }));
        setContacts(data);
      } catch (error) {
        console.error("Error fetching contacts", error);
      }
    };

    fetchContacts();
  }, [searchTerm]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    console.log("Raw user data from localStorage:", userData);
    if (userData && userData !== "undefined") {
      try {
        const parsed = JSON.parse(userData);
        console.log("Parsed user object:", parsed);
        console.log("Available keys:", Object.keys(parsed));
      } catch (e) {
        console.error("Failed to parse user data:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (roomId) {
      const token = localStorage.getItem("access_token");
      const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/room/${roomId}/?token=${token}`);

      socket.onopen = () => {
        console.log("✅ Connected to room:", roomId);
        console.log("🔍 Current user:", currentUser);
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("📩 Message from server:", data);

        if (data.type === "new_message") {
          setMessages((prev) => {
            const messageExists = prev.some(msg =>
              msg.id === parseInt(data.id) ||
              (msg.sender === (data.sender.fullname || data.sender.full_name) &&
                msg.content === data.message &&
                Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 5000)
            );

            if (messageExists) {
              return prev;
            }

            const senderName = data.sender.fullname || data.sender.full_name || "";
            const isOwnMessage = senderName === currentUser;

            console.log("🔍 Sender:", senderName, "Current User:", currentUser, "Is Own:", isOwnMessage);

            return [
              ...prev,
              {
                id: parseInt(data.id),
                sender: senderName,
                content: data.message,
                timestamp: new Date(data.timestamp).toLocaleTimeString(),
                isOwn: isOwnMessage,
                type: "text",
              },
            ];
          });
        }

        if (data.type === "message_history") {
          const history = data.messages.map((msg: any) => {
            const senderName = msg.sender.fullname || msg.sender.full_name || "";
            const isOwnMessage = senderName === currentUser;

            return {
              id: parseInt(msg.id),
              sender: senderName,
              content: msg.message,
              timestamp: new Date(msg.timestamp).toLocaleTimeString(),
              isOwn: isOwnMessage,
              type: "text",
            };
          });
          setMessages(history.reverse());
        }
      };

      socket.onclose = () => console.log("❌ Disconnected from room:", roomId);

      setWs(socket);

      return () => socket.close();
    }
  }, [roomId, currentUser]);

  const startChat = async (contact: Contact) => {
    setSelectedContact(contact);
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/v1/chat/start/",
        { username: contact.name },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`
          }
        }
      );

      setRoomId(response.data.room_id);
      setMessages([]);
    } catch (error) {
      console.error("Error starting chat", error);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && ws) {
      ws.send(JSON.stringify({ action: "send", message }));
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "pdf":
        return <FileText className="w-4 h-4 text-red-600" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-blue-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <MainLayout>
      <div className="flex h-full">
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
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

          <div className="flex-1 overflow-y-auto">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => startChat(contact)}
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${selectedContact?.id === contact.id ? "bg-blue-50 border-blue-200" : ""
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {contact.name}
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

        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              <div className="bg-white border-b border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {selectedContact.name}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="font-medium text-slate-800">{selectedContact.name}</h2>
                      <p className="text-sm text-slate-500">{selectedContact.online ? "Online" : "Offline"}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                <div className="space-y-2">
                  {messages.map((msg) => {
                    console.log("Rendering message:", msg.id, "Sender:", msg.sender, "IsOwn:", msg.isOwn);
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-xs lg:max-w-md ${msg.isOwn ? "ml-auto" : "mr-auto"}`}>
                          {msg.type === "text" ? (
                            <div
                              className={`px-4 py-2 rounded-2xl ${msg.isOwn
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
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
                                    <p className="text-xs text-slate-500">Document</p>
                                  </div>
                                  <Button size="sm" variant="ghost">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          <p
                            className={`text-xs text-slate-500 mt-1 ${msg.isOwn ? "text-right" : "text-left"
                              }`}
                          >
                            {msg.timestamp}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </div>

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
  );
}