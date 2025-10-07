import { Check, CheckCheck } from "lucide-react"

interface MessageStatusProps {
  status: "sending" | "sent" | "delivered" | "read" | "read_file"
  isOwn: boolean
  isGroup?: boolean
  readCount?: number 
  totalMembers?: number 
}

export function MessageStatus({ 
  status, 
  isOwn, 
  isGroup = false, 
  readCount = 0, 
  totalMembers = 0 
}: MessageStatusProps) {
  if (!isOwn || isGroup) return null

  const getStatusIcon = () => {
    switch (status) {
      case "sending":
        return <div className="w-3 h-3 border border-gray-400 rounded-full animate-spin" />
      case "sent":
        return <Check className="w-3 h-3 text-gray-400" />
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-gray-400" />
      case "read":
      case "read_file":
        if (isGroup) {
          return (
            <div className="flex items-center gap-1">
              <CheckCheck className="w-3 h-3 text-blue-400" />
              {readCount > 0 && (
                <span className="text-xs text-blue-400">
                  {readCount}/{totalMembers}
                </span>
              )}
            </div>
          )
        }
        return <CheckCheck className="w-3 h-3 text-blue-400" />
      default:
        return null
    }
  }

  return (
    <div className="flex items-center">
      {getStatusIcon()}
    </div>
  )
}