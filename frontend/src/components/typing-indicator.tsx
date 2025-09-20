"use client"

import { useState, useEffect } from "react"

interface TypingIndicatorProps {
  isVisible: boolean
  userName?: string
  multiple?: boolean
}

export function TypingIndicator({ isVisible, userName = "Kimdir" }: TypingIndicatorProps) {
  const [dots, setDots] = useState("")

  useEffect(() => {
    if (!isVisible) return

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ""
        return prev + "."
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>
        {userName} yozmoqda{dots}
      </span>
    </div>
  )
}
