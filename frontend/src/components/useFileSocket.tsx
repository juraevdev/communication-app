import { useEffect, useRef } from "react"

interface FileItem {
    id: number
    name: string
    type: string
    size: string
    uploadedBy: string
    uploadDate: string
    downloadCount: number
}

interface FileEvent {
    type: "file_list" | "file_uploaded" | "file_deleted" | "file_updated"
    files?: FileItem[]
    file?: FileItem
    file_id?: number
}

export function useFilesSocket(
onFileList: (files: FileItem[]) => void, onFileUploaded: (file: FileItem) => void, onFileDeleted: (fileId: number) => void, onFileUpdated?: (file: FileItem) => void, roomId?: number | null) {
    const socketRef = useRef<WebSocket | null>(null)
    useEffect(() => {
        if (!roomId) return;
        const token = localStorage.getItem("access_token");
        const socket = new WebSocket(`ws://127.0.0.1:8000/ws/chat/room/${roomId}/?token=${token}`);

        socket.onopen = () => {
            console.log("✅ Connected to room:", roomId);
            socket.send(JSON.stringify({ action: "get_files" }));
        };

        socket.onmessage = (event) => {
            try {
                const data: FileEvent = JSON.parse(event.data)

                if (data.type === "file_list" && data.files) {
                    onFileList(data.files)
                } else if (data.type === "file_uploaded" && data.file) {
                    onFileUploaded(data.file)
                } else if (data.type === "file_deleted" && data.file_id) {
                    onFileDeleted(data.file_id)
                } else if (data.type === "file_updated" && data.file && onFileUpdated) {
                    onFileUpdated(data.file)
                }
            } catch (err) {
                console.error("❌ Files WebSocket parse error:", err)
            }
        }

        socket.onclose = () => {
            console.warn("❌ Files WebSocket disconnected")
            setTimeout(() => {
                console.log("🔄 Reconnecting Files WebSocket...")
                useFilesSocket(onFileList, onFileUploaded, onFileDeleted, onFileUpdated)
            }, 3000)
        }

        socket.onerror = (err) => {
            console.error("⚠️ Files WebSocket error:", err)
        }

        return () => {
            console.log("🔌 Closing Files WebSocket")
            socket.close()
        }
    }, [roomId, onFileList, onFileUploaded, onFileDeleted, onFileUpdated])

    const sendMessage = (msg: object) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(msg))
        }
    }

    return { sendMessage }
}
