import React from 'react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState } from 'react';
import { 
  Phone, 
  Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  X,
  Users,
} from "lucide-react";

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callInfo: {
    roomId: string;
    type: 'private' | 'group';
    name: string;
  } | null;
  videoCall: {
    localStream: MediaStream | null;
    remoteStreams: Map<number, MediaStream>;
    callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'failed';
    participants: Array<{id: number, name: string}>;
    isAudioMuted: boolean;
    isVideoMuted: boolean;
    endCall: () => void;
    toggleAudio: () => boolean;
    toggleVideo: () => boolean;
  };
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  callInfo,
  videoCall
}) => {
  const {
    localStream,
    remoteStreams,
    callStatus,
    participants,
    isAudioMuted,
    isVideoMuted,
    endCall,
    toggleAudio,
    toggleVideo,
  } = videoCall;

  // Har bir remote stream uchun alohida ref
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const remoteStreamsArray = Array.from(remoteStreams.entries());

  // Local video stream o'rnatish
  useEffect(() => {
    if (!isOpen) return;

    console.log('[VideoCallModal] 📹 Local stream status:', {
      hasStream: !!localStream,
      hasVideo: localStream?.getVideoTracks().length || 0,
      hasAudio: localStream?.getAudioTracks().length || 0,
      videoMuted: isVideoMuted
    });

    if (localVideoRef.current && localStream) {
      console.log('[VideoCallModal] 🎬 Setting local video srcObject');
      
      try {
        localVideoRef.current.srcObject = localStream;
        
        // Forcefully play
        const playPromise = localVideoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[VideoCallModal] ✅ Local video playing successfully');
              setVideoError(null);
            })
            .catch(error => {
              console.error('[VideoCallModal] ❌ Local video play error:', error);
              setVideoError('Video playback failed. Click to enable.');
              
              // User interaction orqali play qilish
              const enableVideo = () => {
                localVideoRef.current?.play()
                  .then(() => {
                    console.log('[VideoCallModal] ✅ Manual play successful');
                    setVideoError(null);
                  })
                  .catch(console.error);
                document.removeEventListener('click', enableVideo);
              };
              document.addEventListener('click', enableVideo);
            });
        }

        // Video metadata yuklanganda
        localVideoRef.current.onloadedmetadata = () => {
          console.log('[VideoCallModal] 📊 Local video metadata loaded:', {
            width: localVideoRef.current?.videoWidth,
            height: localVideoRef.current?.videoHeight,
            duration: localVideoRef.current?.duration
          });
        };

        // Video play bo'lganda
        localVideoRef.current.onplay = () => {
          console.log('[VideoCallModal] ▶️ Local video started playing');
        };

        // Video pause bo'lganda
        localVideoRef.current.onpause = () => {
          console.log('[VideoCallModal] ⏸️ Local video paused');
        };

      } catch (error) {
        console.error('[VideoCallModal] ❌ Error setting local video:', error);
        setVideoError('Failed to setup video');
      }
    }
  }, [localStream, isOpen, isVideoMuted]);

  // Remote video streams o'rnatish
  useEffect(() => {
    if (!isOpen) return;

    remoteStreamsArray.forEach((entry) => {
      const [userId, stream] = entry;
      const videoElement = remoteVideoRefs.current.get(userId);
      
      if (videoElement && stream) {
        console.log('[VideoCallModal] 📹 Setting remote video for user:', userId);
        
        try {
          videoElement.srcObject = stream;
          
          const playPromise = videoElement.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('[VideoCallModal] ✅ Remote video playing for user:', userId);
              })
              .catch(error => {
                console.error('[VideoCallModal] ❌ Remote video play error for user:', userId, error);
              });
          }

          videoElement.onloadedmetadata = () => {
            console.log('[VideoCallModal] 📊 Remote video metadata loaded for user:', userId);
          };

        } catch (error) {
          console.error('[VideoCallModal] ❌ Error setting remote video:', error);
        }
      }
    });
  }, [remoteStreamsArray, isOpen]);

  const handleEndCall = (): void => {
    endCall();
    onClose();
  };

  // Manual video enable
  const handleVideoClick = () => {
    if (localVideoRef.current) {
      localVideoRef.current.play().catch(console.error);
      setVideoError(null);
    }
  };

  if (!isOpen) return null;

  const getGridClass = (): string => {
    const totalParticipants = remoteStreamsArray.length + 1;
    
    if (totalParticipants === 1) return 'grid-cols-1 max-w-2xl';
    if (totalParticipants === 2) return 'grid-cols-2 max-w-4xl';
    if (totalParticipants <= 4) return 'grid-cols-2 lg:grid-cols-2 max-w-6xl';
    return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-gray-700 text-green-400">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-white font-bold text-xl">
                {callInfo?.type === 'group' ? callInfo.name : `Call with ${callInfo?.name}`}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-green-400 text-sm font-medium">
                  {callStatus === 'connected' ? 'Connected' : callStatus}
                </span>
                <span className="text-gray-400 text-sm">•</span>
                <span className="text-gray-400 text-sm">
                  {participants.length + 1} participants
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-gray-700 rounded-full w-10 h-10 p-0 transition-all"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Video Grid */}
        <ScrollArea className="flex-1 p-6 bg-gray-950">
          <div className={`grid gap-6 ${getGridClass()} mx-auto h-full`}>
            {/* Local Video */}
            <div 
              className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video min-h-[250px] shadow-lg group cursor-pointer"
              onClick={handleVideoClick}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover bg-gray-900"
                style={{ transform: 'scaleX(-1)' }} // Mirror effect
              />
              
              {/* User label */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 px-3 py-1.5 rounded-full text-white text-sm font-medium backdrop-blur-sm z-10">
                You 
                {isAudioMuted && <span className="ml-2">🔇</span>}
                {isVideoMuted && <span className="ml-1">📹❌</span>}
              </div>
              
              {/* Video error message */}
              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-20">
                  <div className="text-center p-4">
                    <div className="text-yellow-400 text-sm mb-2">{videoError}</div>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={handleVideoClick}
                    >
                      Enable Video
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Video muted overlay */}
              {isVideoMuted && !videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <VideoOff className="h-12 w-12 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Camera is off</p>
                  </div>
                </div>
              )}
              
              {/* Loading state */}
              {!localStream && !isVideoMuted && !videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-gray-400 text-sm">Loading camera...</p>
                  </div>
                </div>
              )}

              {/* Debug info (dev only) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-black bg-opacity-50 px-2 py-1 rounded">
                  Stream: {localStream ? '✅' : '❌'} | 
                  Video: {localStream?.getVideoTracks()[0]?.enabled ? '✅' : '❌'} |
                  Audio: {localStream?.getAudioTracks()[0]?.enabled ? '✅' : '❌'}
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {remoteStreamsArray.map(([userId, stream]) => {
              const participant = participants.find(p => p.id === userId);

              return (
                <div key={userId} className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video min-h-[250px] shadow-lg group">
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(userId, el);
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover bg-gray-900"
                  />
                  
                  <div className="absolute top-4 left-4 bg-black bg-opacity-70 px-3 py-1.5 rounded-full text-white text-sm font-medium backdrop-blur-sm">
                    {participant?.name || `User ${userId}`}
                  </div>

                  {/* Debug info for remote stream */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-black bg-opacity-50 px-2 py-1 rounded">
                      User: {userId} | Tracks: {stream?.getTracks().length || 0}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No remote participants */}
            {remoteStreamsArray.length === 0 && callStatus === 'connected' && (
              <div className="col-span-2 flex items-center justify-center h-64">
                <div className="text-center">
                  <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-gray-400 text-lg font-semibold mb-2">Waiting for participants</h3>
                  <p className="text-gray-500">Share the room link to invite others</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Controls */}
        <div className="p-6 border-t border-gray-700 bg-gray-800 rounded-b-xl">
          <div className="flex items-center justify-center gap-4">
            {/* Audio Toggle */}
            <Button
              variant="outline"
              size="lg"
              onClick={toggleAudio}
              className={`rounded-full w-14 h-14 p-0 border-2 transition-all ${
                isAudioMuted 
                  ? 'bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700' 
                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
              }`}
            >
              {isAudioMuted ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-white" />
              )}
            </Button>

            {/* Video Toggle */}
            <Button
              variant="outline"
              size="lg"
              onClick={toggleVideo}
              className={`rounded-full w-14 h-14 p-0 border-2 transition-all ${
                isVideoMuted 
                  ? 'bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700' 
                  : 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
              }`}
            >
              {isVideoMuted ? (
                <VideoOff className="h-6 w-6 text-white" />
              ) : (
                <Video className="h-6 w-6 text-white" />
              )}
            </Button>

            {/* End Call */}
            <Button
              variant="destructive"
              size="lg"
              onClick={handleEndCall}
              className="rounded-full w-16 h-16 p-0 bg-red-600 hover:bg-red-700 border-2 border-red-600 transition-all transform hover:scale-105"
            >
              <Phone className="h-7 w-7 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};