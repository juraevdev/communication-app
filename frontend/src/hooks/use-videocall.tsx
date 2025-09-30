// hooks/use-videocall.tsx
import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVideoCallProps {
  currentUserId?: number;
  currentUserName?: string;
}

export const useVideoCall = ({ 
  currentUserId, 
  currentUserName = 'User' 
}: UseVideoCallProps) => {
  const [state, setState] = useState({
    isInCall: false,
    localStream: null as MediaStream | null,
    remoteStreams: new Map<number, MediaStream>(),
    callStatus: 'idle' as 'idle' | 'calling' | 'ringing' | 'connected' | 'failed',
    participants: [] as Array<{id: number, name: string}>,
    isAudioMuted: false,
    isVideoMuted: false,
    incomingCall: null as { 
      roomId: string; 
      fromUserId: number; 
      fromUserName: string; 
      callType: 'video' | 'audio' 
    } | null,
    isRinging: false,
    isWsConnected: false, // ✅ Yangi state: WebSocket connection status
  });

  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const videoCallWs = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const currentRoomId = useRef<string | null>(null);
  const pendingMessages = useRef<any[]>([]); // ✅ Yangi: Kutayotgan xabarlar

  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  // WebSocket initialization
  const initializeWebSocket = useCallback((roomId: string): void => {
    try {
      currentRoomId.current = roomId;
      const token = localStorage.getItem('access_token')
      const wsUrl = `ws://172.16.8.92:8000/ws/videocall/${roomId}/?token=${token}`;
      
      console.log('[VideoCall] Connecting to WebSocket:', wsUrl);
      
      videoCallWs.current = new WebSocket(wsUrl);
      
      videoCallWs.current.onopen = (): void => {
        console.log('[VideoCall] WebSocket connected to room:', roomId);
        setState(prev => ({ ...prev, isWsConnected: true }));
        
        // ✅ Avvalo join_call xabarini yuborish
        sendWebSocketMessage({ 
          type: 'join_call',
          from_user_id: currentUserId,
          user_name: currentUserName
        });

        // ✅ Kutayotgan xabarlarni yuborish
        flushPendingMessages();
      };

      videoCallWs.current.onmessage = async (event: MessageEvent): Promise<void> => {
        try {
          const data = JSON.parse(event.data);
          console.log('[VideoCall] Received message:', data);
          await handleSignalingMessage(data);
        } catch (error) {
          console.error('[VideoCall] Error parsing message:', error);
        }
      };

      videoCallWs.current.onclose = (event: CloseEvent): void => {
        console.log('[VideoCall] WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({ ...prev, isWsConnected: false }));
        if (state.isInCall) {
          endCall();
        }
      };

      videoCallWs.current.onerror = (error: Event): void => {
        console.error('[VideoCall] WebSocket error:', error);
        setState(prev => ({ ...prev, callStatus: 'failed', isWsConnected: false }));
      };

    } catch (error) {
      console.error('[VideoCall] WebSocket connection failed:', error);
      setState(prev => ({ ...prev, callStatus: 'failed', isWsConnected: false }));
    }
  }, [currentUserId, currentUserName, state.isInCall]);

  // ✅ Yangi: Kutayotgan xabarlarni yuborish
  const flushPendingMessages = useCallback((): void => {
    if (pendingMessages.current.length > 0) {
      console.log('[VideoCall] Flushing pending messages:', pendingMessages.current.length);
      pendingMessages.current.forEach(message => {
        sendWebSocketMessage(message);
      });
      pendingMessages.current = [];
    }
  }, []);

  // ✅ Yangilangan WebSocket message sender
  const sendWebSocketMessage = useCallback((message: any): void => {
    if (videoCallWs.current?.readyState === WebSocket.OPEN && state.isWsConnected) {
      videoCallWs.current.send(JSON.stringify(message));
      console.log('[VideoCall] Sent message:', message);
    } else {
      console.warn('[VideoCall] WebSocket not ready, queuing message:', message);
      // ✅ WebSocket tayyor bo'lmaganda xabarlarni saqlab qo'yish
      pendingMessages.current.push(message);
    }
  }, [state.isWsConnected]);

  // Peer connection creation
  const createPeerConnection = useCallback((userId: number): RTCPeerConnection => {
    console.log('[VideoCall] Creating peer connection for user:', userId);
    
    const pc = new RTCPeerConnection(rtcConfig);
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        console.log('[VideoCall] Adding local track:', track.kind);
        pc.addTrack(track, state.localStream!);
      });
    }

    pc.ontrack = (event: RTCTrackEvent): void => {
      console.log('[VideoCall] Received remote track from user:', userId);
      const remoteStream = event.streams[0];
      
      if (remoteStream) {
        setState(prev => {
          const newRemoteStreams = new Map(prev.remoteStreams);
          newRemoteStreams.set(userId, remoteStream);
          return { ...prev, remoteStreams: newRemoteStreams };
        });
        
        console.log('[VideoCall] Remote stream added for user:', userId);
      }
    };

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent): void => {
      if (event.candidate) {
        console.log('[VideoCall] Sending ICE candidate to:', userId);
        sendWebSocketMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
          to_user_id: userId,
          from_user_id: currentUserId,
        });
      }
    };

    pc.onconnectionstatechange = (): void => {
      console.log(`[VideoCall] Peer connection state for ${userId}:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = (): void => {
      console.log(`[VideoCall] ICE connection state for ${userId}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('[VideoCall] Peer connection established with:', userId);
      }
    };

    peerConnections.current.set(userId, pc);
    return pc;
  }, [state.localStream, sendWebSocketMessage, currentUserId]);

  // Signaling message handler
  const handleSignalingMessage = useCallback(async (data: any): Promise<void> => {
    const { type, from_user_id, user_name } = data;

    if (!from_user_id || from_user_id === currentUserId) return;

    console.log('[VideoCall] Handling message type:', type, 'from:', from_user_id);

    switch (type) {
      case 'user_joined':
        console.log('[VideoCall] User joined:', from_user_id, user_name);
        setState(prev => ({
          ...prev,
          participants: [...prev.participants, { id: from_user_id, name: user_name }]
        }));
        
        // Yangi user ga offer yuborish
        setTimeout(() => {
          createOffer(from_user_id);
        }, 1000);
        break;

      case 'user_left':
        console.log('[VideoCall] User left:', from_user_id);
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

      case 'call_invitation':
        console.log('[VideoCall] Received call invitation from:', from_user_id);
        setState(prev => ({
          ...prev,
          incomingCall: {
            roomId: data.room_id,
            fromUserId: from_user_id,
            fromUserName: data.from_user_name,
            callType: data.call_type || 'video'
          },
          isRinging: true
        }));
        break;

      case 'call_response':
        console.log('[VideoCall] Received call response from:', from_user_id);
        if (data.accepted) {
          setState(prev => ({ ...prev, isRinging: false }));
          console.log('[VideoCall] Call accepted by:', from_user_id);
        } else {
          setState(prev => ({ 
            ...prev, 
            incomingCall: null, 
            isRinging: false 
          }));
          console.log('[VideoCall] Call rejected by:', from_user_id);
        }
        break;

      case 'offer':
        console.log('[VideoCall] Handling offer from:', from_user_id);
        await handleOffer(data.offer, from_user_id);
        break;

      case 'answer':
        console.log('[VideoCall] Handling answer from:', from_user_id);
        await handleAnswer(data.answer, from_user_id);
        break;

      case 'ice_candidate':
        console.log('[VideoCall] Handling ICE candidate from:', from_user_id);
        await handleIceCandidate(data.candidate, from_user_id);
        break;
    }
  }, [currentUserId]);

  // WebRTC handlers
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, fromUserId: number): Promise<void> => {
    console.log('[VideoCall] Handling offer from:', fromUserId);
    
    const pc = createPeerConnection(fromUserId);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[VideoCall] Set remote description for:', fromUserId);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[VideoCall] Created and set local answer for:', fromUserId);
      
      sendWebSocketMessage({
        type: 'answer',
        answer: answer,
        to_user_id: fromUserId,
        from_user_id: currentUserId,
      });
      
    } catch (error) {
      console.error('[VideoCall] Error handling offer:', error);
    }
  }, [createPeerConnection, sendWebSocketMessage, currentUserId]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, fromUserId: number): Promise<void> => {
    console.log('[VideoCall] Handling answer from:', fromUserId);
    
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[VideoCall] Set remote answer for:', fromUserId);
      } catch (error) {
        console.error('[VideoCall] Error handling answer:', error);
      }
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, fromUserId: number): Promise<void> => {
    console.log('[VideoCall] Handling ICE candidate from:', fromUserId);
    
    const pc = peerConnections.current.get(fromUserId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[VideoCall] Added ICE candidate for:', fromUserId);
      } catch (error) {
        console.error('[VideoCall] Error adding ICE candidate:', error);
      }
    }
  }, []);

  const createOffer = useCallback(async (userId: number): Promise<void> => {
    console.log('[VideoCall] Creating offer for user:', userId);
    
    const pc = createPeerConnection(userId);
    
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await pc.setLocalDescription(offer);
      console.log('[VideoCall] Created and set local offer for:', userId);
      
      sendWebSocketMessage({
        type: 'offer',
        offer: offer,
        to_user_id: userId,
        from_user_id: currentUserId,
      });
      
    } catch (error) {
      console.error('[VideoCall] Error creating offer:', error);
    }
  }, [createPeerConnection, sendWebSocketMessage, currentUserId]);

  // ✅ Yangilangan call invitation function
  const sendCallInvitation = useCallback((roomId: string, toUserId: number, callType: 'video' | 'audio' = 'video'): void => {
  const invitationMessage = {
    type: 'call_invitation',
    room_id: roomId,
    call_type: callType,
    from_user_id: currentUserId,
    user_name: currentUserName,
    to_user_id: toUserId  // ✅ Maqsadli foydalanuvchi ID si
  };

  console.log('[VideoCall] Sending call invitation:', invitationMessage);
  sendWebSocketMessage(invitationMessage);
}, [sendWebSocketMessage, currentUserId, currentUserName]);

  const sendCallResponse = useCallback((roomId: string, toUserId: number, accepted: boolean): void => {
  const responseMessage = {
    type: 'call_response',
    room_id: roomId,
    accepted: accepted,
    from_user_id: currentUserId,
    user_name: currentUserName,
    to_user_id: toUserId  // ✅ Maqsadli foydalanuvchi ID si
  };

  console.log('[VideoCall] Sending call response:', responseMessage);
  sendWebSocketMessage(responseMessage);
}, [sendWebSocketMessage, currentUserId, currentUserName]);

  // Main call controls
  const startCall = useCallback(async (roomId: string): Promise<void> => {
    try {
      console.log('[VideoCall] Starting call in room:', roomId);
      setState(prev => ({ ...prev, callStatus: 'calling' }));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      console.log('[VideoCall] Got local media stream');
      
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

      initializeWebSocket(roomId);

    } catch (error) {
      console.error('[VideoCall] Error starting call:', error);
      setState(prev => ({ ...prev, callStatus: 'failed' }));
      throw error;
    }
  }, [initializeWebSocket]);

  const joinCall = useCallback(async (roomId: string): Promise<void> => {
    try {
      console.log('[VideoCall] Joining call in room:', roomId);
      setState(prev => ({ ...prev, callStatus: 'ringing' }));
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      console.log('[VideoCall] Got local media stream');
      
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

      initializeWebSocket(roomId);

    } catch (error) {
      console.error('[VideoCall] Error joining call:', error);
      setState(prev => ({ ...prev, callStatus: 'failed' }));
      throw error;
    }
  }, [initializeWebSocket]);

  const acceptCall = useCallback(async (): Promise<void> => {
  if (state.incomingCall) {
    console.log('[VideoCall] Accepting call:', state.incomingCall.roomId);
    await joinCall(state.incomingCall.roomId);
    
    // ✅ Jo'natuvchiga javob yuborish
    sendCallResponse(state.incomingCall.roomId, state.incomingCall.fromUserId, true);
    
    setState(prev => ({ 
      ...prev, 
      incomingCall: null, 
      isRinging: false 
    }));
  }
}, [state.incomingCall, joinCall, sendCallResponse]);

// Reject call funksiyasini yangilang
const rejectCall = useCallback((): void => {
  if (state.incomingCall) {
    console.log('[VideoCall] Rejecting call:', state.incomingCall.roomId);
    
    // ✅ Jo'natuvchiga javob yuborish
    sendCallResponse(state.incomingCall.roomId, state.incomingCall.fromUserId, false);
    
    setState(prev => ({ 
      ...prev, 
      incomingCall: null, 
      isRinging: false 
    }));
  }
}, [state.incomingCall, sendCallResponse]);

  const endCall = useCallback((): void => {
    console.log('[VideoCall] Ending call');
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }

    peerConnections.current.forEach((pc, userId) => {
      pc.close();
      console.log('[VideoCall] Closed peer connection for user:', userId);
    });
    peerConnections.current.clear();

    if (videoCallWs.current) {
      videoCallWs.current.close();
      videoCallWs.current = null;
    }

    setState({
      isInCall: false,
      localStream: null,
      remoteStreams: new Map(),
      callStatus: 'idle',
      participants: [],
      isAudioMuted: false,
      isVideoMuted: false,
      incomingCall: null,
      isRinging: false,
      isWsConnected: false,
    });
    
    currentRoomId.current = null;
    pendingMessages.current = [];
  }, [state.localStream]);

  // Media controls
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
      
      peerConnections.current.forEach((pc, userId) => {
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
          peerConnections.current.forEach((pc, userId) => {
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
      console.error('[VideoCall] Error sharing screen:', error);
    }
  }, [state.localStream]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (state.isInCall) {
        endCall();
      }
    };
  }, [state.isInCall, endCall]);

  return {
    ...state,
    startCall,
    joinCall,
    endCall,
    toggleAudio,
    toggleVideo,
    shareScreen,
    localVideoRef,
    sendCallInvitation,
    acceptCall,
    rejectCall,
  };
};