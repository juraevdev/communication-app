import { useState, useEffect, useRef } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, Search, Download, Trash2, FileText, ImageIcon, File, VideoIcon, ArchiveIcon, X } from "lucide-react"

interface FileItem {
    id: number
    name: string
    type: string
    size: string
    uploadedBy: string
    uploadDate: string
    downloadCount: number
    isOwner: boolean
    roomId?: number
    fileUrl: string
    fileName: string
}

interface FileUploadState {
    file: File | null;
    uploading: boolean;
    progress: number;
    error: string | null;
}

export default function FilesPage() {
    const [files, setFiles] = useState<FileItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [user, setUser] = useState<{ email: string; role: string; name: string } | null>(null)
    const [loading, setLoading] = useState(true)
    const [isConnected, setIsConnected] = useState(false)
    const ws = useRef<WebSocket | null>(null)
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
    const [fileUpload, setFileUpload] = useState<FileUploadState>({
        file: null,
        uploading: false,
        progress: 0,
        error: null
    });
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const userData = localStorage.getItem("user")
        if (userData) {
            setUser(JSON.parse(userData))
        }

        connectWebSocket()
        return () => {
            if (ws.current) {
                ws.current.close()
            }
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current)
            }
        }
    }, [])

    const connectWebSocket = () => {
        const token = localStorage.getItem("access_token")
        if (!token) {
            console.error('No access token found')
            return
        }

        try {
            const wsUrl = `ws://hisobot2.stat.uz/ws/files/?token=${token}`
            ws.current = new WebSocket(wsUrl)

            ws.current.onopen = () => {
                console.log('WebSocket connected')
                setIsConnected(true)
                requestFiles()
            }

            ws.current.onmessage = (event) => {
                handleWebSocketMessage(event.data)
            }

            ws.current.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason)
                setIsConnected(false)
                reconnectTimeout.current = setTimeout(() => {
                    connectWebSocket()
                }, 3000)
            }

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error)
                setIsConnected(false)
                setFileUpload(prev => ({ ...prev, uploading: false, error: "Connection error" }))
            }

        } catch (error) {
            console.error('WebSocket connection error:', error)
            setIsConnected(false)
        }
    }

    const handleWebSocketMessage = (data: string) => {
        try {
            const message = JSON.parse(data)

            switch (message.type) {
                case 'file_list':
                    setFiles(message.files)
                    setLoading(false)
                    break

                case 'file_uploaded':
                    setFiles(prev => [...prev, message.file])
                    setFileUpload(prev => ({ ...prev, uploading: false, progress: 100 }))
                    setTimeout(() => {
                        setFileUpload({ file: null, uploading: false, progress: 0, error: null })
                    }, 1000)
                    break

                case 'file_deleted':
                    setFiles(prev => prev.filter(f => f.id !== message.file_id))
                    break

                case 'error':
                    console.error('WebSocket error:', message.message)
                    setFileUpload(prev => ({ ...prev, uploading: false, error: message.message }))
                    break

                case 'success':
                    console.log('WebSocket success:', message.message)
                    break

                default:
                    console.log('Unknown message type:', message.type)
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error)
        }
    }

    const sendWebSocketMessage = (action: string, data: any = {}) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            const message = {
                action,
                ...data
            }
            ws.current.send(JSON.stringify(message))
        } else {
            console.error('WebSocket is not connected')
            setFileUpload(prev => ({ ...prev, uploading: false, error: "Connection lost" }))
        }
    }

    const requestFiles = () => {
        sendWebSocketMessage('get_files')
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                setFileUpload(prev => ({ ...prev, error: "File size must be less than 10MB" }))
                return
            }
            
            setFileUpload({
                file,
                uploading: false,
                progress: 0,
                error: null
            })
        }
    }

    const handleFileUpload = async () => {
        if (!fileUpload.file || !ws.current) return;

        setFileUpload(prev => ({ ...prev, uploading: true, progress: 0, error: null }));

        try {
            const reader = new FileReader();

            reader.onloadstart = () => {
                setFileUpload(prev => ({ ...prev, progress: 10 }));
            };

            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round((event.loaded / event.total) * 50) + 10;
                    setFileUpload(prev => ({ ...prev, progress }));
                }
            };

            reader.onload = (e) => {
                const base64Data = e.target?.result as string;

                sendWebSocketMessage('upload_file', {
                    file_data: base64Data,
                    file_name: fileUpload.file!.name,
                    file_type: getFileTypeFromName(fileUpload.file!.name)
                });

                const uploadInterval = setInterval(() => {
                    setFileUpload(prev => {
                        const newProgress = Math.min(prev.progress + 5, 90);
                        if (newProgress >= 90) {
                            clearInterval(uploadInterval);
                        }
                        return { ...prev, progress: newProgress };
                    });
                }, 200);
            };

            reader.onerror = () => {
                setFileUpload(prev => ({ ...prev, uploading: false, error: "Failed to read file" }));
            };

            reader.readAsDataURL(fileUpload.file);

        } catch (error) {
            console.error("Error uploading file:", error);
            setFileUpload(prev => ({ ...prev, uploading: false, error: "Upload failed" }));
        }
    };

    const cancelUpload = () => {
        setFileUpload({ file: null, uploading: false, progress: 0, error: null })
    }

    const handleSelectFileClick = () => {
        fileInputRef.current?.click();
    }

    const getFileTypeFromName = (fileName: string): string => {
        const extension = fileName.split('.').pop()?.toLowerCase() || ''
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return 'image'
        if (['mp4', 'avi', 'mov', 'wmv'].includes(extension)) return 'video'
        if (['mp3', 'wav', 'ogg'].includes(extension)) return 'audio'
        if (extension === 'pdf') return 'pdf'
        if (['doc', 'docx'].includes(extension)) return 'document'
        if (['xls', 'xlsx'].includes(extension)) return 'spreadsheet'
        if (['zip', 'rar'].includes(extension)) return 'archive'
        if (extension === 'txt') return 'text'
        return 'file'
    }

    const filteredFiles = files.filter(
        (file) =>
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = (fileId: number) => {
        if (user?.role === "Admin" || files.find(f => f.id === fileId)?.isOwner) {
            if (window.confirm("Haqiqatan ham bu faylni o'chirmoqchimisiz?")) {
                sendWebSocketMessage('delete_file', { file_id: fileId })
            }
        } else {
            alert("Sizda bu faylni o'chirish uchun ruxsat yo'q")
        }
    }

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

            sendWebSocketMessage('file_downloaded', { file_url: fileUrl })

        } catch (error) {
            console.error('Yuklab olishda xatolik:', error);
            alert('Faylni yuklab olish mumkin emas. Iltimos, keyinroq urunib ko\'ring.');
        }
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case "pdf":
                return <FileText className="w-4 h-4 text-red-600" />
            case "image":
                return <ImageIcon className="w-4 h-4 text-blue-600" />
            case "video":
                return <VideoIcon className="w-4 h-4 text-purple-600" />
            case "document":
                return <FileText className="w-4 h-4 text-blue-600" />
            case "spreadsheet":
                return <FileText className="w-4 h-4 text-green-600" />
            case "archive":
                return <ArchiveIcon className="w-4 h-4 text-yellow-600" />
            case "text":
                return <FileText className="w-4 h-4 text-gray-600" />
            default:
                return <File className="w-4 h-4 text-slate-600" />
        }
    }

    const getFileBadgeColor = (type: string) => {
        switch (type) {
            case "pdf": return "bg-red-100 text-red-800"
            case "image": return "bg-blue-100 text-blue-800"
            case "video": return "bg-purple-100 text-purple-800"
            case "audio": return "bg-green-100 text-green-800"
            case "document": return "bg-blue-100 text-blue-800"
            case "spreadsheet": return "bg-green-100 text-green-800"
            case "archive": return "bg-yellow-100 text-yellow-800"
            case "text": return "bg-gray-100 text-gray-800"
            default: return "bg-slate-100 text-slate-800"
        }
    }

    return (
        <MainLayout>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">My Files</h1>
                        <p className="text-sm text-gray-500">All send and received files</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {fileUpload.file && (
                            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                                <span className="text-sm text-blue-700 truncate max-w-xs">
                                    {fileUpload.file.name}
                                </span>
                                {!fileUpload.uploading && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={cancelUpload}
                                        className="h-6 w-6 p-0"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        )}
                        
                        <Button 
                            onClick={handleSelectFileClick}
                            className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-white">
                            <Upload className="w-4 h-4 mr-2" />
                            {fileUpload.uploading ? 'Uploading...' : 'Upload File'}
                        </Button>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.pptx,.xlsx,.mp4,.mp3,.zip,.rar"/>
                    </div>
                </div>

                {fileUpload.file && (
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded">
                                        {getFileIcon(getFileTypeFromName(fileUpload.file.name))}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm truncate max-w-xs">
                                            {fileUpload.file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {Math.round(fileUpload.file.size / 1024)} KB
                                        </p>
                                    </div>
                                </div>
                                
                                {!fileUpload.uploading ? (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={handleFileUpload}>
                                            Upload
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelUpload}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelUpload}>
                                        Cancel
                                    </Button>
                                )}
                            </div>
                            
                            {fileUpload.uploading && (
                                <div className="space-y-2">
                                    <Progress value={fileUpload.progress} className="w-full" />
                                    <p className="text-xs text-gray-500 text-center">
                                        {fileUpload.progress}% complete
                                    </p>
                                </div>
                            )}
                            
                            {fileUpload.error && (
                                <p className="text-sm text-red-600 text-center">
                                    {fileUpload.error}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardContent className="p-4 flex items-center space-x-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Fayllarni qidirish..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"/>
                        </div>
                        <Badge>{filteredFiles.length} files</Badge>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium">All Files</h3>
                    </CardHeader>
                    <CardContent>
                        {!isConnected ? (
                            <p className="p-4 text-center text-yellow-600">
                                Connecting to server...
                            </p>
                        ) : loading ? (
                            <p className="p-4 text-center text-slate-500">Loading...</p>
                        ) : filteredFiles.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead></TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded By</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredFiles.map((file) => (
                                        <TableRow key={file.id}>
                                            <TableCell>{getFileIcon(file.type)}</TableCell>
                                            <TableCell className="font-medium">{file.name}</TableCell>
                                            <TableCell>
                                                <Badge className={getFileBadgeColor(file.type)}>
                                                    {file.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{file.size}</TableCell>
                                            <TableCell>{file.uploadedBy} {file.isOwner && "(You)"}</TableCell>
                                            <TableCell>{file.uploadDate}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleDownload(file.fileUrl!, file.fileName!)}
                                                    title="Yuklab olish"
                                                    disabled={!isConnected}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                {(user?.role === "Admin" || file.isOwner) && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(file.id)}
                                                        title="O'chirish"
                                                        disabled={!isConnected}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="p-4 text-center text-slate-500">
                                No files found
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}