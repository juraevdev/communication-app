// hooks/use-notification-websocket.ts
import { useEffect, useRef, useCallback } from 'react';

interface NotificationWebSocketProps {
  userId: number | undefined;
  onCallInvitation: (data: {
    roomId: string;
    fromUserId: number;
    fromUserName: string;
    callType: 'video' | 'audio';
  }) => void;
  onCallResponse?: (data: any) => void;
}

export const useNotificationWebSocket = ({
  userId,
  onCallInvitation,
  onCallResponse
}: NotificationWebSocketProps) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!userId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      // Foydalanuvchining shaxsiy notification room'i
      const notificationRoomId = `user_${userId}_notifications`;
      const wsUrl = `wss://planshet2.stat.uz/ws/videocall/${notificationRoomId}/?token=${token}`;
      
      console.log('[NotificationWS] 🔌 Connecting to:', notificationRoomId);
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[NotificationWS] ✅ Connected successfully');
        reconnectAttempts.current = 0;
        
        // Join call xabarini yuborish (backend user guruhiga qo'shish uchun)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'join_call',
            user_id: userId
          }));
          console.log('[NotificationWS] 📡 Joined notification room');
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[NotificationWS] 📨 Received:', data.type, data);

          switch (data.type) {
            case 'call_invitation':
              console.log('[NotificationWS] 📞 Call invitation received from:', data.from_user_name);
              onCallInvitation({
                roomId: data.room_id,
                fromUserId: data.from_user_id,
                fromUserName: data.from_user_name,
                callType: data.call_type || 'video'
              });
              break;

            case 'call_response':
              console.log('[NotificationWS] 📲 Call response received:', data.accepted ? 'accepted' : 'rejected');
              if (onCallResponse) {
                onCallResponse(data);
              }
              break;

            default:
              console.log('[NotificationWS] ℹ️ Ignored message type:', data.type);
          }
        } catch (error) {
          console.error('[NotificationWS] ❌ Error parsing message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[NotificationWS] 🔌 Disconnected:', event.code, event.reason);
        wsRef.current = null;

        // Auto-reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`[NotificationWS] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[NotificationWS] ❌ Max reconnection attempts reached');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[NotificationWS] ❌ WebSocket error:', error);
      };

    } catch (error) {
      console.error('[NotificationWS] ❌ Connection failed:', error);
    }
  }, [userId, onCallInvitation, onCallResponse]);

  useEffect(() => {
    if (userId) {
      console.log('[NotificationWS] 🚀 Initializing for user:', userId);
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        console.log('[NotificationWS] 🛑 Closing connection');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [userId, connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect
  };
};