// edit-message-modal.tsx
import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { X, Send } from "lucide-react"

interface EditMessageModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (newContent: string) => void
  originalMessage: string
  messageType?: "text" | "file"
}

export function EditMessageModal({
  isOpen,
  onClose,
  onSave,
  originalMessage,
  messageType = "text"
}: EditMessageModalProps) {
  const [editedContent, setEditedContent] = useState("")

  useEffect(() => {
    if (isOpen) {
      // Agar file message bo'lsa, faqat file nomini olamiz
      if (messageType === "file" && originalMessage.startsWith("File: ")) {
        setEditedContent(originalMessage.replace("File: ", ""))
      } else {
        setEditedContent(originalMessage)
      }
    }
  }, [isOpen, originalMessage, messageType])

  const handleSave = () => {
    if (editedContent.trim()) {
      // Agar file message bo'lsa, "File: " prefiksini qaytaramiz
      const finalContent = messageType === "file" 
        ? `File: ${editedContent.trim()}`
        : editedContent.trim()
      
      onSave(finalContent)
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave()
    }
    if (e.key === "Escape") {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Edit Message</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-4">
          {messageType === "file" ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Editing file name:
              </p>
              <Input
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter new file name..."
                className="bg-gray-700 border-gray-600 text-white"
                autoFocus
              />
            </div>
          ) : (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Edit your message..."
              className="bg-gray-700 border-gray-600 text-white min-h-[100px] resize-none"
              autoFocus
            />
          )}
        </div>
        
        <div className="flex justify-end gap-2 p-4 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="text-gray-400 border-gray-600 hover:bg-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!editedContent.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}