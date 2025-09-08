import React, { useState, useEffect } from "react"
import axios from "axios"
import { MainLayout } from "@/components/layout/main-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, Search, Download, Trash2, FileText, ImageIcon, File, VideoIcon, ArchiveIcon } from "lucide-react"

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
}

export default function FilesPage() {
    const [files, setFiles] = useState<FileItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [user, setUser] = useState<{ email: string; role: string; name: string } | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const userData = localStorage.getItem("user")
        if (userData) {
            setUser(JSON.parse(userData))
        }
        
        loadUserFiles()
    }, [])

    const loadUserFiles = () => {
        setLoading(true)
        axios.get("http://127.0.0.1:8000/api/v1/chat/user-files/", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            }
        })
        .then(response => {
            setFiles(response.data)
            setLoading(false)
        })
        .catch(error => {
            console.error('Error loading files:', error)
            setLoading(false)
        })
    }

    const filteredFiles = files.filter(
        (file) =>
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.type.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            const formData = new FormData()
            formData.append("file", file)

            axios.post("http://127.0.0.1:8000/api/v1/chat/files-upload/", formData, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    'Content-Type': 'multipart/form-data',
                }
            })
            .then((response) => {
                console.log("Uploaded:", response.data)
                setSelectedFile(null)
                loadUserFiles()
            })
            .catch((error) => {
                console.error("Upload error:", error)
                setSelectedFile(null)
            })
        }
    }

    const handleDelete = (fileId: number) => {
        if (user?.role === "Admin" || files.find(f => f.id === fileId)?.isOwner) {
            if (window.confirm("Haqiqatan ham bu faylni o'chirmoqchimisiz?")) {
                axios.delete(`http://127.0.0.1:8000/api/v1/chat/files/${fileId}/`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                    }
                })
                .then(() => {
                    setFiles(prev => prev.filter(f => f.id !== fileId))
                })
                .catch(err => console.error('Delete error:', err))
            }
        } else {
            alert("Sizda bu faylni o'chirish uchun ruxsat yo'q")
        }
    }

    const handleDownload = (fileId: number) => {
        window.open(`http://127.0.0.1:8000/api/v1/files/${fileId}/download/`, "_blank")
        setTimeout(loadUserFiles, 1000)
    }

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
                        <p className="text-sm text-gray-500">All send and recieved files</p>
                    </div>
                    <label htmlFor="file-upload">
                        <Button className="bg-blue-600 hover:bg-blue-700 cursor-pointer text-white">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload File
                        </Button>
                    </label>
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.pptx,.xlsx,.mp4,.mp3,.zip,.rar"
                    />
                </div>

                <Card>
                    <CardContent className="p-4 flex items-center space-x-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Fayllarni qidirish..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Badge>{filteredFiles.length} files</Badge>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-medium">All Files</h3>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
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
                                                    onClick={() => handleDownload(file.id)}
                                                    title="Yuklab olish"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                {(user?.role === "Admin" || file.isOwner) && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(file.id)}
                                                        title="O'chirish"
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
                                No data
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}