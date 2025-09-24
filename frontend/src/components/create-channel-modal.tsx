import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Hash, Lock, Globe } from "lucide-react"

interface CreateChannelModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateChannelModal({ isOpen, onClose }: CreateChannelModalProps) {
  const [channelData, setChannelData] = useState({
    name: "",
    description: "",
    isPrivate: false,
    username: "",
  })

  const handleCreateChannel = () => {
    if (!channelData.name.trim()) return

    console.log("Creating channel:", channelData)
    onClose()
    setChannelData({
      name: "",
      description: "",
      isPrivate: false,
      username: "",
    })
  }

  const generateUsername = (name: string) => {
    const username = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 20)
    setChannelData({ ...channelData, username })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              placeholder="Kanal nomini kiriting"
              value={channelData.name}
              onChange={(e) => {
                setChannelData({ ...channelData, name: e.target.value })
                if (!channelData.username) {
                  generateUsername(e.target.value)
                }
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-username">Channel link</Label>
            <div className="flex items-center">
              <Input
                id="channel-username"
                placeholder="invite link"
                value={channelData.username}
                onChange={(e) => setChannelData({ ...channelData, username: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Description</Label>
            <Textarea
              id="channel-description"
              placeholder="About channel"
              value={channelData.description}
              onChange={(e) => setChannelData({ ...channelData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button className="cursor-pointer hover:scale-105 transition duration-300" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button className="cursor-pointer hover:scale-105 transition duration-300" onClick={handleCreateChannel} disabled={!channelData.name.trim()}>
              <Hash className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
