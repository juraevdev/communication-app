import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Paperclip,
  Search,
  MoreVertical,
  FileText,
  ImageIcon,
  Download,
  X,
  File,
  Video,
  Music,
} from "lucide-react";

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  type: "text" | "file";
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  fileSize?: number;
}

interface Contact {
  id: number;
  name: string;
  image: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  isOnline?: boolean;
  lastSeen?: string;
}

interface StatusUpdate {
  type: "status_update";
  user_id: number;
  status: "online" | "offline";
  timestamp: string;
}

interface FileUploadState {
  file: File | null;
  preview: string | null;
  uploading: boolean;
  progress: number;
}

export default function ChatPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<number, { isOnline: boolean; lastSeen?: string }>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [statusWs, setStatusWs] = useState<WebSocket | null>(null);
  const [fileUpload, setFileUpload] = useState<FileUploadState>({
    file: null,
    preview: null,
    uploading: false,
    progress: 0
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCurrentUser = () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (!storedUser || storedUser === "undefined" || storedUser === "null") return "";
      const parsedUser = JSON.parse(storedUser);
      return (
        parsedUser.fullname ||
        parsedUser.username ||
        parsedUser.name ||
        parsedUser.email ||
        ""
      );
    } catch {
      return "";
    }
  };
  const currentUser = useMemo(getCurrentUser, []);

  const handleStatusUpdate = useCallback((data: StatusUpdate) => {
    console.log("📡 Status update:", data);

    const newStatus = {
      isOnline: data.status === "online",
      lastSeen: data.status === "offline" ? data.timestamp : undefined
    };

    setUserStatuses(prev => {
      const updated = new Map(prev);
      updated.set(data.user_id, newStatus);
      return updated;
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    console.log("🔌 Connecting to status WebSocket...");
    const statusSocket = new WebSocket(`ws://127.0.0.1:8000/ws/status/?token=${token}`);

    statusSocket.onopen = () => {
      console.log("✅ Status WebSocket connected - READY FOR REAL-TIME");
    };

    statusSocket.onmessage = (event) => {
      try {
        const data: StatusUpdate = JSON.parse(event.data);
        if (data.type === "status_update") {
          handleStatusUpdate(data);
        }
      } catch (error) {
        console.error("Status parse error:", error);
      }
    };

    statusSocket.onclose = () => {
      console.log("❌ Status WebSocket disconnected");
      setTimeout(() => {
        console.log("🔄 Attempting to reconnect status WebSocket...");
      }, 3000);
    };

    statusSocket.onerror = (error) => {
      console.error("Status WebSocket error:", error);
    };

    setStatusWs(statusSocket);

    return () => {
      console.log("🔌 Closing status WebSocket");
      statusSocket.close();
    };
  }, []);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await axios.get(
          "http://127.0.0.1:8000/api/v1/accounts/contact/filter/",
          {
            params: { search: searchTerm },
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            },
          }
        );

        const data: Contact[] = response.data.map((user: any) => {
          const liveStatus = userStatuses.get(user.id);

          return {
            id: user.id,
            name: user.alias || user.fullname || user.username || user.email,
            image: user.image || "",
            lastMessage: user.last_message || "",
            timestamp: user.last_message_timestamp || "",
            unread: user.unread_count || 0,
            isOnline: liveStatus ? liveStatus.isOnline : (user.is_online || false),
            lastSeen: liveStatus ? liveStatus.lastSeen : (user.last_seen || ""),
          };
        });

        setContacts(data);
        console.log("📋 Contacts loaded with real-time status");
      } catch (error) {
        console.error("Error fetching contacts", error);
      }
    };

    fetchContacts();
  }, [searchTerm, userStatuses]);

  useEffect(() => {
    if (selectedContact) {
      const liveStatus = userStatuses.get(selectedContact.id);
      if (liveStatus) {
        setSelectedContact(prev => prev ? {
          ...prev,
          isOnline: liveStatus.isOnline,
          lastSeen: liveStatus.lastSeen || prev.lastSeen
        } : null);
      }
    }
  }, [userStatuses, selectedContact?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId) return;
    const token = localStorage.getItem("access_token");
    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/room/${roomId}/?token=${token}`);

    socket.onopen = () => {
      console.log("✅ Connected to room:", roomId);
      console.log("👤 Current user:", currentUser);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 Message from server:", data);

      if (data.type === "new_message") {
        setMessages((prev) => {
          const messageExists = prev.some(
            (msg) =>
              msg.id === parseInt(data.id) ||
              ((data.sender?.fullname || data.sender?.full_name || "") === msg.sender &&
                msg.content === data.message &&
                Math.abs(
                  new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()
                ) < 5000)
          );
          if (messageExists) return prev;
          const senderName = data.sender.fullname || data.sender.full_name || "";
          const isOwnMessage = senderName === currentUser;
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

      if (data.type === "file_uploaded") {
        setMessages((prev) => {
          const senderName = data.user?.full_name || "";
          const isOwnMessage = senderName === currentUser;
          return [
            ...prev,
            {
              id: parseInt(data.id),
              sender: senderName,
              content: data.file_name,
              timestamp: new Date(data.uploaded_at).toLocaleTimeString(),
              isOwn: isOwnMessage,
              type: "file",
              fileName: data.file_name,
              fileUrl: data.file_url,
              fileType: getFileTypeFromName(data.file_name),
            },
          ];
        });
        // Reset file upload state
        setFileUpload({
          file: null,
          preview: null,
          uploading: false,
          progress: 0
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
  }, [roomId, currentUser]);

  const startChat = async (contact: Contact) => {
    setSelectedContact(contact);
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/v1/chat/start/",
        { contact_user: contact.id, alias: contact.name },
        { headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` } }
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }

    // Create preview for images
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
    if (!fileUpload.file || !ws) return;

    setFileUpload(prev => ({ ...prev, uploading: true, progress: 0 }));

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;

        // Send file via WebSocket
        ws.send(JSON.stringify({
          action: "upload_file",
          file_data: base64Data,
          file_name: fileUpload.file!.name,
          file_type: fileUpload.file!.type
        }));

        // Simulate upload progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setFileUpload(prev => ({ ...prev, progress }));
          if (progress >= 100) {
            clearInterval(interval);
          }
        }, 200);
      };

      reader.readAsDataURL(fileUpload.file);
    } catch (error) {
      console.error("Error uploading file:", error);
      setFileUpload(prev => ({ ...prev, uploading: false, progress: 0 }));
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const token = localStorage.getItem("access_token");

      const response = await fetch(fileUrl, {
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
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Yuklab olishda xatolik:', error);
      alert('Faylni yuklab olish mumkin emas. Iltimos, keyinroq urunib ko\'ring.');
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
    if (fileType?.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-600" />;
    if (fileType?.includes('video')) return <Video className="w-4 h-4 text-purple-600" />;
    if (fileType?.includes('audio')) return <Music className="w-4 h-4 text-green-600" />;
    if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
    return <File className="w-4 h-4 text-slate-600" />;
  };

  const getFileTypeFromName = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv'].includes(extension || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(extension || '')) return 'audio';
    if (extension === 'pdf') return 'pdf';
    return 'file';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return "";
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const OnlineIndicator = ({ isOnline }: { isOnline?: boolean }) => {
    return (
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'
        }`}></div>
    );
  };

  const StatusText = ({ isOnline, lastSeen }: { isOnline?: boolean; lastSeen?: string }) => {
    if (isOnline) {
      return <span className="text-xs text-green-600 font-medium">online</span>;
    }
    if (lastSeen) {
      return <span className="text-xs text-gray-500">last seen {formatLastSeen(lastSeen)}</span>;
    }
    return <span className="text-xs text-gray-500">offline</span>;
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
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedContact?.id === contact.id ? "bg-blue-50 border-blue-200" : ""
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      {contact.image ? (
                        <img
                          src={contact.image}
                          alt={contact.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {contact.name.charAt(0)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <OnlineIndicator isOnline={contact.isOnline} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 truncate">{contact.name}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex flex-col">
                        <p className="text-sm text-slate-600 truncate">{contact.lastMessage}</p>
                        <StatusText isOnline={contact.isOnline} lastSeen={contact.lastSeen} />
                      </div>
                      {contact.unread > 0 && (
                        <Badge className="bg-blue-600 text-white text-xs px-2 py-1 ml-2">
                          {contact.unread}
                        </Badge>
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
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        {selectedContact.image ? (
                          <img
                            src={selectedContact.image}
                            alt={selectedContact.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {selectedContact.name.charAt(0)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <OnlineIndicator isOnline={selectedContact.isOnline} />
                    </div>
                    <div>
                      <h2 className="font-medium text-slate-800">{selectedContact.name}</h2>
                      <StatusText isOnline={selectedContact.isOnline} lastSeen={selectedContact.lastSeen} />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
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
                                  <p className="text-sm font-medium text-slate-800 truncate">
                                    {msg.fileName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {msg.fileType === 'image' ? 'Image' :
                                      msg.fileType === 'video' ? 'Video' :
                                        msg.fileType === 'audio' ? 'Audio' : 'Document'}
                                  </p>
                                </div>
                                {msg.fileUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDownload(msg.fileUrl!, msg.fileName!)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              {msg.fileType === 'image' && msg.fileUrl && (
                                <div className="mt-2">
                                  <img
                                    src={msg.fileUrl}
                                    alt={msg.fileName}
                                    className="max-w-full h-auto rounded-lg"
                                    style={{ maxHeight: '200px' }}
                                  />
                                </div>
                              )}
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
              </div>

              {/* File preview section */}
              {fileUpload.file && (
                <div className="bg-white border-t border-slate-200 p-4">
                  <div className="flex items-center space-x-3 bg-slate-50 rounded-lg p-3">
                    {fileUpload.preview ? (
                      <img
                        src={fileUpload.preview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center">
                        {getFileIcon(fileUpload.file.type)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {fileUpload.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(fileUpload.file.size)}
                      </p>
                      {fileUpload.uploading && (
                        <Progress value={fileUpload.progress} className="mt-2" />
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
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRemoveFile}
                        disabled={fileUpload.uploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white border-t border-slate-200 p-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="*/*"
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUpload.uploading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                    disabled={fileUpload.uploading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || fileUpload.uploading}
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