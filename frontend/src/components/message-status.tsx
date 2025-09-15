import { Check, CheckCheck, Clock } from "lucide-react"
import type { Message } from "@/hooks/use-chat"

interface MessageStatusProps {
  status: Message["status"]
  isOwn: boolean
}

export function MessageStatus({ status, isOwn }: MessageStatusProps) {
  if (!isOwn) return null

  switch (status) {
    case "sending":
      return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />
    case "sent":
      return <Check className="h-3 w-3 text-muted-foreground" />
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-500" />
    default:
      return null
  }
}
