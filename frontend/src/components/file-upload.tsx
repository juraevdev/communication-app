// components/file-upload.tsx
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface FileUploadProps {
  roomId: string;
  onFileUploaded: (fileInfo: any) => void;
  disabled?: boolean;
}

export function FileUpload({ roomId, onFileUploaded, disabled = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !roomId) return;

    setIsUploading(true);
    try {
      const fileInfo = await apiClient.uploadFile(selectedFile, Number(roomId));
      onFileUploaded(fileInfo);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return '🖼️';
    } else if (['mp4', 'avi', 'mov', 'wmv'].includes(extension || '')) {
      return '🎥';
    } else if (['mp3', 'wav', 'ogg', 'flac'].includes(extension || '')) {
      return '🎵';
    } else if (extension === 'pdf') {
      return '📄';
    } else if (['doc', 'docx'].includes(extension || '')) {
      return '📝';
    } else if (['xls', 'xlsx'].includes(extension || '')) {
      return '📊';
    } else if (['zip', 'rar', '7z'].includes(extension || '')) {
      return '📦';
    } else {
      return '📎';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      {!selectedFile ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <Paperclip className="h-4 w-4 mr-1" />
          Attach File
        </Button>
      ) : (
        <div className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{getFileIcon(selectedFile.name)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleUpload}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Send'
              )}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFile}
              disabled={isUploading}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}