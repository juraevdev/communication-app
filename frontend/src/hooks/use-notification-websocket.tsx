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
      // Birinchi VideoCall xonasiga ulanamiz (har qanday xona bo'lishi mumkin)
      const wsUrl = `wss://planshet2.stat.uz/ws/videocall/notifications/?token=${token}`;
      
      console.log('[NotificationWS] 🔌 Connecting to notification WebSocket');
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[NotificationWS] ✅ Connected successfully');
        reconnectAttempts.current = 0;
        
        // User group'ga ulanish
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Bu backend'da avtomatik bo'lishi kerak, lekin qo'shimcha xavfsizlik uchun
          console.log('[NotificationWS] 📡 Listening for user', userId);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[NotificationWS] 📨 Received:', data.type, data);

          switch (data.type) {
            case 'call_invitation':
              console.log('[NotificationWS] 📞 Call invitation received:', {
                from: data.from_user_name,
                roomId: data.room_id
              });
              onCallInvitation({
                roomId: data.room_id,
                fromUserId: data.from_user_id,
                fromUserName: data.from_user_name,
                callType: data.call_type || 'video'
              });
              break;

            case 'call_response':
              console.log('[NotificationWS] 📲 Call response received');
              if (onCallResponse) {
                onCallResponse(data);
              }
              break;

            default:
              console.log('[NotificationWS] ℹ️ Unknown message type:', data.type);
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
          console.log(`[NotificationWS] 🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
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