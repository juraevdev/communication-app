import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVideoCallProps {
  currentUserId?: number;
  currentUserName?: string;
}

interface CallState {
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'failed';
  participants: Array<{ id: number; name: string }>;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  incomingCall: {
    roomId: string;
    fromUserId: number;
    fromUserName: string;
    callType: 'video' | 'audio';
  } | null;
  isRinging: boolean;
  isWsConnected: boolean;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export const useVideoCall = ({
  currentUserId,
  currentUserName = 'User'
}: UseVideoCallProps) => {
  const [state, setState] = useState<CallState>({
    isInCall: false,
    localStream: null,
    remoteStreams: new Map<number, MediaStream>(),
    callStatus: 'idle',
    participants: [],
    isAudioMuted: false,
    isVideoMuted: false,
    incomingCall: null,
    isRinging: false,
    isWsConnected: false,
  });

  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const videoCallWs = useRef<WebSocket | null>(null);
  const presenceWs = useRef<WebSocket | null>(null);  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const currentRoomId = useRef<string | null>(null);
  const pendingMessages = useRef<WebSocketMessage[]>([]);

  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  const waitForWebSocketOpen = useCallback((ws: WebSocket | null): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          clearInterval(checkInterval);
          resolve();
        } else if (ws?.readyState === WebSocket.CLOSED || ws?.readyState === WebSocket.CLOSING) {
          clearInterval(checkInterval);
          reject(new Error('WebSocket closed before opening'));
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  }, []);

  const sendWebSocketMessage = useCallback(async (message: WebSocketMessage, isPresence: boolean = false): Promise<void> => {
    try {
      const ws = isPresence ? presenceWs.current : videoCallWs.current;
      
      if (ws?.readyState === WebSocket.OPEN) {
        console.log('[VideoCall] ✅ Sending message:', message.type, 'via', isPresence ? 'presence' : 'call', 'WS');
        ws.send(JSON.stringify(message));
      } else if (ws?.readyState === WebSocket.CONNECTING) {
        console.log('[VideoCall] ⏳ WebSocket connecting, waiting...');
        await waitForWebSocketOpen(ws);
        console.log('[VideoCall] ✅ WebSocket ready, sending message:', message.type);
        ws.send(JSON.stringify(message));
      } else {
        console.warn('[VideoCall] ⚠️ WebSocket not ready, queuing message:', message.type);
        pendingMessages.current.push(message);
      }
    } catch (error) {
      console.error('[VideoCall] ❌ Error sending message:', error);
      pendingMessages.current.push(message);
    }
  }, [waitForWebSocketOpen]);

  const flushPendingMessages = useCallback((): void => {
    if (pendingMessages.current.length > 0) {
      console.log('[VideoCall] 📤 Flushing', pendingMessages.current.length, 'pending messages');
      pendingMessages.current.forEach(message => {
        if (videoCallWs.current?.readyState === WebSocket.OPEN) {
          console.log('[VideoCall] 📨 Sending queued message:', message.type);
          videoCallWs.current.send(JSON.stringify(message));
        }
      });
      pendingMessages.current = [];
    }
  }, []);

  const createPeerConnection = useCallback((userId: number): RTCPeerConnection => {
    console.log('[VideoCall] 🔗 Creating peer connection for user:', userId);

    const pc = new RTCPeerConnection(rtcConfig);

    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        console.log('[VideoCall] ➕ Adding local track:', track.kind);
        pc.addTrack(track, state.localStream!);
      });
    }

    pc.ontrack = (event: RTCTrackEvent): void => {
      console.log('[VideoCall] 📺 Received remote track from user:', userId, 'kind:', event.track.kind);
      const remoteStream = event.streams[0];

      if (remoteStream) {
        setState(prev => {
          const newRemoteStreams = new Map(prev.remoteStreams);
          newRemoteStreams.set(userId, remoteStream);
          console.log('[VideoCall] ✅ Remote stream added. Total streams:', newRemoteStreams.size);
          return { ...prev, remoteStreams: newRemoteStreams };
        });
      }
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
      if (event.candidate) {
        console.log('[VideoCall] 🧊 Sending ICE candidate to:', userId);
        sendWebSocketMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
          from_user_id: currentUserId,
        }, false);
      }
    };

    pc.onconnectionstatechange = (): void => {
      console.log(`[VideoCall] 📊 Peer ${userId} connection state:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('[VideoCall] ✅ Peer connection established with user:', userId);
        setState(prev => ({ ...prev, callStatus: 'connected' }));
      } else if (pc.connectionState === 'failed') {
        console.error('[VideoCall] ❌ Peer connection failed with user:', userId);
        setState(prev => ({ ...prev, callStatus: 'failed' }));
      }
    };

    pc.oniceconnectionstatechange = (): void => {
      console.log(`[VideoCall] 🧊 Peer ${userId} ICE state:`, pc.iceConnectionState);
    };

    peerConnections.current.set(userId, pc);
    return pc;
  }, [state.localStream, sendWebSocketMessage, currentUserId]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: number): Promise<void> => {
    console.log('[VideoCall] 📨 Processing offer from:', fromUserId);

    let pc = peerConnections.current.get(fromUserId);
    
    if (!pc) {
      console.log('[VideoCall] 🔗 Creating new peer connection for offer');
      pc = createPeerConnection(fromUserId);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[VideoCall] ✅ Remote description set');
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[VideoCall] ✅ Local description set');

      await sendWebSocketMessage({
        type: 'answer',
        answer: answer,
        from_user_id: currentUserId,
      }, false);

      console.log('[VideoCall] ✅ Answer sent to:', fromUserId);
    } catch (error) {
      console.error('[VideoCall] ❌ Error handling offer:', error);
    }
  }, [createPeerConnection, sendWebSocketMessage, currentUserId]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, fromUserId: number): Promise<void> => {
    console.log('[VideoCall] 📬 Processing answer from:', fromUserId);
    const pc = peerConnections.current.get(fromUserId);
    
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[VideoCall] ✅ Remote answer set for:', fromUserId);
      } catch (error) {
        console.error('[VideoCall] ❌ Error handling answer:', error);
      }
    } else {
      console.warn('[VideoCall] ⚠️ No peer connection found for user:', fromUserId);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, fromUserId: number): Promise<void> => {
    const pc = peerConnections.current.get(fromUserId);
    
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[VideoCall] ✅ ICE candidate added for:', fromUserId);
      } catch (error) {
        console.error('[VideoCall] ❌ Error adding ICE candidate:', error);
      }
    } else {
      console.warn('[VideoCall] ⚠️ Cannot add ICE candidate - no peer or remote description');
    }
  }, []);

  const createOffer = useCallback(async (userId: number): Promise<void> => {
    console.log('[VideoCall] 📤 Creating offer for user:', userId);

    const pc = createPeerConnection(userId);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);
      console.log('[VideoCall] ✅ Local description set for offer');

      await sendWebSocketMessage({
        type: 'offer',
        offer: offer,
        from_user_id: currentUserId,
      }, false);

      console.log('[VideoCall] ✅ Offer sent to:', userId);
    } catch (error) {
      console.error('[VideoCall] ❌ Error creating offer:', error);
    }
  }, [createPeerConnection, sendWebSocketMessage, currentUserId]);

  const handleSignalingMessage = useCallback(async (data: any): Promise<void> => {
    const { type, from_user_id, user_name } = data;

    if (!from_user_id || from_user_id === currentUserId) return;

    console.log('[VideoCall] 🔄 Handling message:', type, 'from user:', from_user_id);

    switch (type) {
      case 'user_joined':
        console.log('[VideoCall] 👤 User joined:', from_user_id, user_name);
        setState(prev => ({
          ...prev,
          participants: [...prev.participants.filter(p => p.id !== from_user_id), { id: from_user_id, name: user_name }]
        }));

        setTimeout(() => {
          createOffer(from_user_id);
        }, 1000);
        break;

      case 'user_left':
        console.log('[VideoCall] 👋 User left:', from_user_id);
        setState(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.id !== from_user_id),
          remoteStreams: (() => {
            const newStreams = new Map(prev.remoteStreams);
            newStreams.delete(from_user_id);
            return newStreams;
          })(),
        }));

        const pc = peerConnections.current.get(from_user_id);
        if (pc) {
          pc.close();
          peerConnections.current.delete(from_user_id);
        }
        break;

      case 'offer':
        console.log('[VideoCall] 📨 Handling offer from:', from_user_id);
        await handleOffer(data.offer, from_user_id);
        break;

      case 'answer':
        console.log('[VideoCall] 📬 Handling answer from:', from_user_id);
        await handleAnswer(data.answer, from_user_id);
        break;

      case 'ice_candidate':
        console.log('[VideoCall] 🧊 Handling ICE candidate from:', from_user_id);
        await handleIceCandidate(data.candidate, from_user_id);
        break;
    }
  }, [currentUserId, createOffer, handleOffer, handleAnswer, handleIceCandidate]);

  const initializePresenceWebSocket = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (presenceWs.current) {
          console.log('[VideoCall] ℹ️ Presence WebSocket already exists');
          if (presenceWs.current.readyState === WebSocket.OPEN) {
            resolve();
            return;
          }
        }

        const roomId = `user_${currentUserId}`;
        const token = localStorage.getItem('access_token');
        const wsUrl = `wss://planshet2.stat.uz/ws/videocall/${roomId}/?token=${token}`;

        console.log('[VideoCall] 🔌 Connecting presence WebSocket');

        presenceWs.current = new WebSocket(wsUrl);

        presenceWs.current.onopen = (): void => {
          console.log('[VideoCall] ✅ Presence WebSocket connected');
          resolve();
        };

        presenceWs.current.onmessage = async (event: MessageEvent): Promise<void> => {
          try {
            const data = JSON.parse(event.data);
            console.log('[VideoCall] 📩 Presence message:', data.type);

            if (data.type === 'presence_connected') {
              console.log('[VideoCall] ✅ Presence confirmed');
              return;
            }

            if (data.type === 'call_invitation') {
              console.log('[VideoCall] 📞 Call invitation received:', data);
              setState(prev => ({
                ...prev,
                incomingCall: {
                  roomId: data.room_id,
                  fromUserId: data.from_user_id,
                  fromUserName: data.from_user_name,
                  callType: data.call_type || 'video'
                },
                isRinging: true
              }));
              return;
            }

            if (data.type === 'call_response') {
              console.log('[VideoCall] 📲 Call response:', data);
              return;
            }
          } catch (error) {
            console.error('[VideoCall] ❌ Error parsing presence message:', error);
          }
        };

        presenceWs.current.onclose = (): void => {
          console.log('[VideoCall] 🔌 Presence WebSocket disconnected');
          setTimeout(() => {
            console.log('[VideoCall] 🔄 Reconnecting presence WebSocket');
            initializePresenceWebSocket();
          }, 3000);
        };

        presenceWs.current.onerror = (error: Event): void => {
          console.error('[VideoCall] ❌ Presence WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        console.error('[VideoCall] ❌ Failed to initialize presence WebSocket:', error);
        reject(error);
      }
    });
  }, [currentUserId]);

  const initializeCallWebSocket = useCallback((roomId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        if (videoCallWs.current) {
          videoCallWs.current.close();
          videoCallWs.current = null;
        }

        currentRoomId.current = roomId;
        const token = localStorage.getItem('access_token');
        const wsUrl = `wss://planshet2.stat.uz/ws/videocall/${roomId}/?token=${token}`;

        console.log('[VideoCall] 🔌 Connecting call WebSocket to:', roomId);

        videoCallWs.current = new WebSocket(wsUrl);

        videoCallWs.current.onopen = (): void => {
          console.log('[VideoCall] ✅ Call WebSocket connected to room:', roomId);
          setState(prev => ({ ...prev, isWsConnected: true }));

          const joinMessage: WebSocketMessage = {
            type: 'join_call',
            from_user_id: currentUserId,
            user_name: currentUserName
          };

          setTimeout(async () => {
            try {
              await sendWebSocketMessage(joinMessage, false);
              flushPendingMessages();
              console.log('[VideoCall] ✅ Joined call room');
              resolve();
            } catch (error) {
              console.error('[VideoCall] ❌ Failed to join call:', error);
              reject(error);
            }
          }, 200);
        };

        videoCallWs.current.onmessage = async (event: MessageEvent): Promise<void> => {
          try {
            const data = JSON.parse(event.data);
            console.log('[VideoCall] 📩 Call message:', data.type);
            await handleSignalingMessage(data);
          } catch (error) {
            console.error('[VideoCall] ❌ Error parsing call message:', error);
          }
        };

        videoCallWs.current.onclose = (): void => {
          console.log('[VideoCall] 🔌 Call WebSocket disconnected');
          setState(prev => ({ ...prev, isWsConnected: false }));
        };

        videoCallWs.current.onerror = (error: Event): void => {
          console.error('[VideoCall] ❌ Call WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        console.error('[VideoCall] ❌ Failed to initialize call WebSocket:', error);
        reject(error);
      }
    });
  }, [currentUserId, currentUserName, flushPendingMessages, sendWebSocketMessage, handleSignalingMessage]);

  const connectToVideoCallWebSocket = useCallback(async (): Promise<void> => {
    try {
      await initializePresenceWebSocket();
      console.log('[VideoCall] ✅ Presence WebSocket established');
    } catch (error) {
      console.error('[VideoCall] ❌ Failed to establish presence WebSocket:', error);
    }
  }, [initializePresenceWebSocket]);

  const sendCallInvitation = useCallback(async (roomId: string, toUserId: number, callType: 'video' | 'audio' = 'video'): Promise<void> => {
    const currentId = Number(currentUserId);
    const targetId = Number(toUserId);

    console.log('[VideoCall] 📞 Sending call invitation:', {
      roomId,
      from: currentId,
      to: targetId,
      callType
    });

    if (currentId === targetId) {
      console.error('[VideoCall] ❌ Cannot call yourself');
      return;
    }

    const invitationMessage: WebSocketMessage = {
      type: 'call_invitation',
      room_id: roomId,
      call_type: callType,
      to_user_id: toUserId
    };

    console.log('[VideoCall] 📤 Sending via presence WebSocket');
    
    try {
      await sendWebSocketMessage(invitationMessage, true);
      console.log('[VideoCall] ✅ Call invitation sent');
    } catch (error) {
      console.error('[VideoCall] ❌ Failed to send call invitation:', error);
    }
  }, [sendWebSocketMessage, currentUserId]);

  const sendCallResponse = useCallback(async (roomId: string, toUserId: number, accepted: boolean): Promise<void> => {
    const responseMessage: WebSocketMessage = {
      type: 'call_response',
      room_id: roomId,
      accepted: accepted,
      to_user_id: toUserId
    };

    console.log('[VideoCall] 📲 Sending call response:', accepted);
    
    try {
      await sendWebSocketMessage(responseMessage, true);
      console.log('[VideoCall] ✅ Call response sent');
    } catch (error) {
      console.error('[VideoCall] ❌ Failed to send call response:', error);
    }
  }, [sendWebSocketMessage]);

  const startCall = useCallback(async (roomId: string): Promise<void> => {
    try {
      console.log('[VideoCall] 🚀 Starting call in room:', roomId);
      setState(prev => ({ ...prev, callStatus: 'calling' }));

      await initializeCallWebSocket(roomId);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });

      console.log('[VideoCall] ✅ Got local media stream');

      setState(prev => ({
        ...prev,
        localStream: stream,
        isInCall: true,
        callStatus: 'connected',
      }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.error);
      }

    } catch (error) {
      console.error('[VideoCall] ❌ Error starting call:', error);
      setState(prev => ({ ...prev, callStatus: 'failed' }));
      throw error;
    }
  }, [initializeCallWebSocket]);

  const acceptCall = useCallback(async (): Promise<void> => {
    if (!state.incomingCall) {
      console.warn('[VideoCall] ⚠️ No incoming call to accept');
      return;
    }

    const callInfo = state.incomingCall;
    console.log('[VideoCall] ✅ Accepting call:', callInfo.roomId);
    
    try {
      // 1. Avval response yuborish
      await sendCallResponse(callInfo.roomId, callInfo.fromUserId, true);

      // 2. Holatni yangilash
      setState(prev => ({
        ...prev,
        isRinging: false,
        callStatus: 'calling',
        incomingCall: null // Call info endi kerak emas
      }));

      // 3. Call WebSocket ochish
      await initializeCallWebSocket(callInfo.roomId);

      // 4. Media stream olish
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      console.log('[VideoCall] ✅ Got local media stream with tracks:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length
      });

      // 5. Holatni yangilash va video elementga ulash
      setState(prev => ({
        ...prev,
        localStream: stream,
        isInCall: true,
        callStatus: 'connected',
      }));

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        const playPromise = localVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log('[VideoCall] ✅ Local video playing'))
            .catch(err => console.error('[VideoCall] ❌ Video play error:', err));
        }
      }

      console.log('[VideoCall] ✅ Call accepted successfully');

    } catch (error) {
      console.error('[VideoCall] ❌ Error accepting call:', error);
      
      // Xatolik yuz bersa, holatni tozalash
      setState(prev => ({
        ...prev,
        callStatus: 'failed',
        incomingCall: null,
        isRinging: false,
        isInCall: false,
        localStream: null
      }));
      
      throw error;
    }
  }, [state.incomingCall, sendCallResponse, initializeCallWebSocket]);

  const rejectCall = useCallback((): void => {
    if (state.incomingCall) {
      console.log('[VideoCall] ❌ Rejecting call');
      sendCallResponse(state.incomingCall.roomId, state.incomingCall.fromUserId, false);
      setState(prev => ({
        ...prev,
        incomingCall: null,
        isRinging: false
      }));
    }
  }, [state.incomingCall, sendCallResponse]);

  const endCall = useCallback((): void => {
    console.log('[VideoCall] 🛑 Ending call');

    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    peerConnections.current.forEach((pc) => {
      pc.close();
    });
    peerConnections.current.clear();

    if (videoCallWs.current) {
      videoCallWs.current.close();
      videoCallWs.current = null;
    }

    setState(prev => ({
      ...prev,
      isInCall: false,
      localStream: null,
      remoteStreams: new Map(),
      callStatus: 'idle',
      participants: [],
      isAudioMuted: false,
      isVideoMuted: false,
      isWsConnected: false,
    }));

    currentRoomId.current = null;
  }, [state.localStream]);

  const toggleAudio = useCallback((): boolean => {
    if (state.localStream) {
      const audioTracks = state.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks[0].enabled = newState;
        setState(prev => ({ ...prev, isAudioMuted: !newState }));
        return newState;
      }
    }
    return false;
  }, [state.localStream]);

  const toggleVideo = useCallback((): boolean => {
    if (state.localStream) {
      const videoTracks = state.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks[0].enabled = newState;
        setState(prev => ({ ...prev, isVideoMuted: !newState }));
        return newState;
      }
    }
    return false;
  }, [state.localStream]);

  const shareScreen = useCallback(async (): Promise<void> => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const videoTrack = screenStream.getVideoTracks()[0];

      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find(s =>
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      videoTrack.onended = (): void => {
        if (state.localStream) {
          const cameraTrack = state.localStream.getVideoTracks()[0];
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find(s =>
              s.track && s.track.kind === 'video'
            );
            if (sender && cameraTrack) {
              sender.replaceTrack(cameraTrack);
            }
          });
        }
      };

    } catch (error) {
      console.error('[VideoCall] ❌ Error sharing screen:', error);
    }
  }, [state.localStream]);

  const handleExternalCallInvitation = useCallback((data: any) => {
    console.log('[VideoCall] 📞 External call invitation:', data);
    setState(prev => ({
      ...prev,
      incomingCall: {
        roomId: data.room_id,
        fromUserId: data.from_user_id,
        fromUserName: data.from_user_name,
        callType: data.call_type || 'video'
      },
      isRinging: true
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (state.isInCall) {
        endCall();
      }
      if (presenceWs.current) {
        presenceWs.current.close();
      }
    };
  }, [state.isInCall, endCall]);

  return {
    ...state,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    shareScreen,
    localVideoRef,
    sendCallInvitation,
    acceptCall,
    rejectCall,
    handleExternalCallInvitation,
    connectToVideoCallWebSocket,
    videoCallWs,
  };
};