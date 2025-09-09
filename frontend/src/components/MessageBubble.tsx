import type React from "react"
import { useEffect, useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Download,
  Check,
  ImageIcon,
  Video,
  Music,
  FileText,
  File,
  Edit,
  Trash2,
  X,
  Send,
  MoreHorizontal,
} from "lucide-react"

interface Message {
  id: number
  sender: string
  content: string
  timestamp: string
  isOwn: boolean
  type: "text" | "file"
  fileName?: string
  fileType?: string
  fileUrl?: string
  fileSize?: number
  isRead?: boolean
  isUpdated?: boolean
}

interface MessageBubbleProps {
  msg: Message
  onMarkAsRead: (messageId: number) => void
  onDownload: (fileUrl: string, fileName: string) => void
  onEditMessage: (messageId: number, newContent: string) => void
  onDeleteMessage: (messageId: number) => void
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  onMarkAsRead,
  onDownload,
  onEditMessage,
  onDeleteMessage,
}) => {
  const messageRef = useRef<HTMLDivElement>(null)
  const [hasBeenRead, setHasBeenRead] = useState(msg.isRead || false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(msg.content)

  useEffect(() => {
    if (hasBeenRead || msg.isOwn) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !msg.isOwn && !msg.isRead) {
          onMarkAsRead(msg.id)
          setHasBeenRead(true)
        }
      },
      { threshold: 0.7 },
    )

    if (messageRef.current) {
      observer.observe(messageRef.current)
    }

    return () => observer.disconnect()
  }, [msg.id, msg.isOwn, msg.isRead, msg.type, onMarkAsRead, hasBeenRead])

  useEffect(() => {
    setHasBeenRead(msg.isRead || false)
  }, [msg.isRead])

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent !== msg.content) {
      onEditMessage(msg.id, editContent)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(msg.content)
    setIsEditing(false)
  }

  const handleDelete = () => {
    onDeleteMessage(msg.id)
  }

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes("image")) return <ImageIcon className="w-4 h-4 text-blue-600" />
    if (fileType?.includes("video")) return <Video className="w-4 h-4 text-purple-600" />
    if (fileType?.includes("audio")) return <Music className="w-4 h-4 text-green-600" />
    if (fileType?.includes("pdf")) return <FileText className="w-4 h-4 text-red-600" />
    return <File className="w-4 h-4 text-slate-600" />
  }

  return (
    <div ref={messageRef} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"} group relative`}>
      <div className={`max-w-xs lg:max-w-md ${msg.isOwn ? "ml-auto" : "mr-auto"} relative`}>
        {msg.type === "text" ? (
          <div className="relative">
            {isEditing ? (
              <div
                className={`px-4 py-3 rounded-2xl shadow-sm border ${
                  msg.isOwn
                    ? "bg-blue-600 text-white rounded-br-none border-blue-500"
                    : "bg-white text-slate-800 border-slate-200 rounded-bl-none"
                }`}
              >
                <div className="space-y-3">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className={`border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 ${
                      msg.isOwn ? "text-white placeholder:text-blue-100" : "text-slate-800 placeholder:text-slate-400"
                    }`}
                    placeholder="Edit message..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleEditSubmit()
                      }
                      if (e.key === "Escape") {
                        handleCancelEdit()
                      }
                    }}
                  />
                  <div className="flex justify-end space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className={`h-7 w-7 p-0 rounded-full hover:bg-opacity-20 ${
                        msg.isOwn ? "text-white hover:bg-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleEditSubmit}
                      disabled={!editContent.trim() || editContent === msg.content}
                      className={`h-7 w-7 p-0 rounded-full hover:bg-opacity-20 disabled:opacity-50 ${
                        msg.isOwn ? "text-white hover:bg-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`px-4 py-2 rounded-2xl relative transition-all duration-200 ${
                  msg.isOwn
                    ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-sm"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>

                {msg.isOwn && (
                  <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1">
                    {msg.isRead ? (
                      <div className="flex">
                        <Check className="w-3 h-3 text-white" />
                        <Check className="w-3 h-3 text-white -ml-1.5" />
                      </div>
                    ) : (
                      <Check className="w-3 h-3 text-blue-300" />
                    )}
                  </div>
                )}
              </div>
            )}

            {msg.isOwn && !isEditing && (
              <div
                className={`absolute top-0 ${msg.isOwn ? "-left-10" : "-right-10"} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        ) : (
          <Card
            className={`${msg.isOwn ? "bg-blue-50 border-blue-200" : ""} relative shadow-sm transition-all duration-200`}
          >
            <CardContent className="p-3">
              <div className="flex items-center space-x-3">
                {getFileIcon(msg.fileType || "file")}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{msg.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {msg.fileType === "image"
                      ? "Image"
                      : msg.fileType === "video"
                        ? "Video"
                        : msg.fileType === "audio"
                          ? "Audio"
                          : "Document"}
                  </p>
                </div>
                {msg.fileUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDownload(msg.fileUrl!, msg.fileName!)}
                    className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {msg.fileType === "image" && msg.fileUrl && (
                <div className="mt-2">
                  <img
                    src={msg.fileUrl || "/placeholder.svg"}
                    alt={msg.fileName}
                    className="max-w-full h-auto rounded-lg"
                    style={{ maxHeight: "200px" }}
                  />
                </div>
              )}

              {msg.isOwn && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border border-slate-200 shadow-sm">
                  {msg.isRead ? (
                    <div className="flex">
                      <Check className="w-3 h-3 text-blue-500" />
                      <Check className="w-3 h-3 text-blue-500 -ml-1.5" />
                    </div>
                  ) : (
                    <Check className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              )}
            </CardContent>

            {msg.isOwn && (
              <div
                className={`absolute top-2 ${msg.isOwn ? "-left-10" : "-right-10"} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50 text-slate-600"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 focus:text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </Card>
        )}

        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs text-slate-500 ${msg.isOwn ? "text-right" : "text-left"}`}>
            {msg.timestamp}
            {msg.isUpdated && <span className="ml-1 text-slate-400 italic">edited</span>}
          </p>
        </div>
      </div>
    </div>
  )
}

export default MessageBubble