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
    alert("Kanal muvaffaqiyatli yaratildi!")
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
          <DialogTitle>Yangi kanal yaratish</DialogTitle>
          <DialogDescription>Kanal ma'lumotlarini kiriting va sozlamalarni tanlang</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Kanal nomi *</Label>
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
            <Label htmlFor="channel-username">Kanal manzili</Label>
            <div className="flex items-center">
              <span className="text-muted-foreground mr-1">@</span>
              <Input
                id="channel-username"
                placeholder="kanal_manzili"
                value={channelData.username}
                onChange={(e) => setChannelData({ ...channelData, username: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kanalga qo'shilish uchun ishlatiladi. Faqat harflar, raqamlar va pastki chiziq.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Tavsif</Label>
            <Textarea
              id="channel-description"
              placeholder="Kanal haqida qisqacha ma'lumot"
              value={channelData.description}
              onChange={(e) => setChannelData({ ...channelData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {channelData.isPrivate ? (
                <Lock className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Globe className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">{channelData.isPrivate ? "Shaxsiy kanal" : "Ochiq kanal"}</p>
                <p className="text-xs text-muted-foreground">
                  {channelData.isPrivate
                    ? "Faqat taklif orqali qo'shilish mumkin"
                    : "Har kim qo'shilishi va ko'rishi mumkin"}
                </p>
              </div>
            </div>
            <Switch
              checked={channelData.isPrivate}
              onCheckedChange={(checked) => setChannelData({ ...channelData, isPrivate: checked })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button onClick={handleCreateChannel} disabled={!channelData.name.trim()}>
              <Hash className="mr-2 h-4 w-4" />
              Kanal yaratish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
