import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Check, ImageIcon, Video, Music, FileText, File } from "lucide-react";

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
  isRead?: boolean;
  isUpdated?: boolean;
}

interface MessageBubbleProps {
  msg: Message;
  onMarkAsRead: (messageId: number) => void;
  onDownload: (fileUrl: string, fileName: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, onMarkAsRead, onDownload }) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const [hasBeenRead, setHasBeenRead] = useState(msg.isRead || false);

  // MessageBubble komponentida
useEffect(() => {
  if (hasBeenRead || msg.isOwn) return;
  
  const observer = new IntersectionObserver(  
    ([entry]) => {
      if (entry.isIntersecting && !msg.isOwn && !msg.isRead) {
        onMarkAsRead(msg.id);
        setHasBeenRead(true);
      }
    },
    { threshold: 0.7 }
  );

  if (messageRef.current) {
    observer.observe(messageRef.current);
  }

  return () => observer.disconnect();
}, [msg.id, msg.isOwn, msg.isRead, msg.type, onMarkAsRead, hasBeenRead]);

  useEffect(() => {
    if (hasBeenRead || msg.isOwn) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !msg.isOwn && !msg.isRead) {
          onMarkAsRead(msg.id);
          setHasBeenRead(true);
        }
      },
      { threshold: 0.7 }
    );

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => observer.disconnect();
  }, [msg.id, msg.isOwn, msg.isRead, onMarkAsRead]);

  useEffect(() => {
    setHasBeenRead(msg.isRead || false);
  }, [msg.isRead]);

  const getFileIcon = (fileType: string) => {
    if (fileType?.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-600" />;
    if (fileType?.includes('video')) return <Video className="w-4 h-4 text-purple-600" />;
    if (fileType?.includes('audio')) return <Music className="w-4 h-4 text-green-600" />;
    if (fileType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
    return <File className="w-4 h-4 text-slate-600" />;
  };

  return (
    <div ref={messageRef} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-xs lg:max-w-md ${msg.isOwn ? "ml-auto" : "mr-auto"}`}>
        {msg.type === "text" ? (
          <div
            className={`px-4 py-2 rounded-2xl relative ${msg.isOwn
                ? "bg-blue-600 text-white rounded-br-none"
                : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
              }`}
          >
            <p className="text-sm">{msg.content}</p>

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
        ) : (
          <Card className={`${msg.isOwn ? "bg-blue-50 border-blue-200" : ""} relative`}>
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
                    onClick={() => onDownload(msg.fileUrl!, msg.fileName!)}
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

              {msg.isOwn && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 border">
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
          </Card>
        )}

        <div className="flex items-center justify-between mt-1">
          <p className={`text-xs text-slate-500 ${msg.isOwn ? "text-right" : "text-left"}`}>
            {msg.timestamp}
          </p>

          {msg.isUpdated && (
            <span className="text-xs text-slate-400 italic ml-2">edited</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;