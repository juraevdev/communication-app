// types/video-call.ts
// types/video-call.ts
import type { RefObject } from 'react';

export interface VideoCallParticipant {
  id: number;
  name: string;
  stream?: MediaStream;
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface VideoCallState {
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'failed';
  participants: VideoCallParticipant[];
  isAudioMuted: boolean;
  isVideoMuted: boolean;
}

export interface VideoCallControls {
  startCall: (roomId: string) => Promise<void>;
  joinCall: (roomId: string) => Promise<void>;
  endCall: () => void;
  toggleAudio: () => boolean;
  toggleVideo: () => boolean;
  shareScreen: () => Promise<void>;
  localVideoRef: RefObject<HTMLVideoElement | null>;
}

export interface WebRTCSignalingMessage {
  type: 'offer' | 'answer' | 'ice_candidate' | 'user_joined' | 'user_left' | 'join_call' | 'leave_call';
  from_user_id?: number;
  to_user_id?: number;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  user_name?: string;
}