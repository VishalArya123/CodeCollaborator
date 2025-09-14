import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const CallContext = createContext();

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }) => {
  const { socket, connected } = useSocket();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callParticipants, setCallParticipants] = useState([]);
  const [isInCall, setIsInCall] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState({});
  const [callError, setCallError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [usesFallbackMode, setUsesFallbackMode] = useState(false);
  
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef({});
  const audioAnalyserRef = useRef(null);
  const currentRoomRef = useRef(null);
  const peerConnectionsRef = useRef({});
  
  const PAGE_SIZE = 4;
  const [currentPage, setCurrentPage] = useState(0);

  const socketRequest = (event, data, timeout = 15000) => {
    return new Promise((resolve, reject) => {
      if (!socket || !connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Socket request timeout: ${event}`));
      }, timeout);

      socket.emit(event, data, (response) => {
        clearTimeout(timer);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  };

  // FIXED: Fallback initialization without mediasoup
  const initializeFallbackMode = async () => {
    try {
      console.log('Initializing fallback WebRTC mode');
      setUsesFallbackMode(true);
      
      // Just get user media for fallback mode
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      setupSpeakingDetection(stream);
      
      return true;
    } catch (error) {
      console.error('Error in fallback mode initialization:', error);
      throw error;
    }
  };

  const initializeMediasoupMode = async (roomId) => {
    try {
      // Dynamically import mediasoup-client only when needed
      const mediasoupClient = await import('mediasoup-client');
      
      if (deviceRef.current && deviceRef.current.loaded) {
        return deviceRef.current;
      }

      deviceRef.current = new mediasoupClient.Device();
      
      const routerRtpCapabilities = await socketRequest('getRouterRtpCapabilities', { roomId });
      await deviceRef.current.load({ routerRtpCapabilities });
      
      setUsesFallbackMode(false);
      return deviceRef.current;
    } catch (error) {
      console.warn('Mediasoup initialization failed, switching to fallback mode:', error.message);
      return await initializeFallbackMode();
    }
  };

  const setupSpeakingDetection = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      audioAnalyserRef.current = audioContext.createAnalyser();
      audioAnalyserRef.current.fftSize = 512;
      audioAnalyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(audioAnalyserRef.current);

      const dataArray = new Uint8Array(audioAnalyserRef.current.frequencyBinCount);
      
      const checkSpeaking = () => {
        if (!audioAnalyserRef.current || !localStream) return;
        
        audioAnalyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, val) => sum + val) / dataArray.length;
        const isCurrentlySpeaking = average > 25;
        
        if (isCurrentlySpeaking !== isSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
          if (socket && currentRoomRef.current) {
            socket.emit('speaking-status', {
              userId: socket.id,
              isSpeaking: isCurrentlySpeaking,
              roomId: currentRoomRef.current,
            });
          }
        }
        
        if (localStream) {
          requestAnimationFrame(checkSpeaking);
        }
      };
      
      checkSpeaking();
    } catch (error) {
      console.error('Error setting up speaking detection:', error);
    }
  };

  const startOrJoinCall = async (roomId) => {
    if (isInCall || isInitializing) return;
    
    setIsInitializing(true);
    setCallError(null);
    currentRoomRef.current = roomId;
    
    try {
      console.log('Starting/joining call in room:', roomId);
      
      // Get user media first
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      setupSpeakingDetection(stream);

      // Try to initialize mediasoup, fallback to simple WebRTC if it fails
      try {
        await initializeMediasoupMode(roomId);
        console.log('Using advanced mediasoup mode');
      } catch (error) {
        console.log('Using fallback WebRTC mode');
        setUsesFallbackMode(true);
      }
      
      // Notify server about joining call
      socket.emit('start-call', { roomId });
      
      setIsInCall(true);
      
      if (usesFallbackMode) {
        toast.success('Joined audio call (basic mode)');
      } else {
        toast.success('Joined audio call successfully!');
      }
      
      console.log('Successfully joined audio call');
    } catch (error) {
      console.error('Error starting/joining call:', error);
      setCallError(error.message || 'Failed to join audio call');
      toast.error('Failed to join audio call');
      
      await leaveCall(roomId);
    } finally {
      setIsInitializing(false);
    }
  };

  const leaveCall = async (roomId) => {
    try {
      console.log('Leaving call in room:', roomId);
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      // Close all peer connections in fallback mode
      Object.values(peerConnectionsRef.current).forEach(pc => {
        try {
          pc.close();
        } catch (error) {
          console.error('Error closing peer connection:', error);
        }
      });
      peerConnectionsRef.current = {};
      
      // Clean up mediasoup resources if available
      Object.values(producersRef.current).forEach(producer => {
        try {
          producer.close();
        } catch (error) {
          console.error('Error closing producer:', error);
        }
      });
      producersRef.current = {};
      
      Object.values(consumersRef.current).forEach(consumer => {
        try {
          consumer.close();
        } catch (error) {
          console.error('Error closing consumer:', error);
        }
      });
      consumersRef.current = {};
      
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
        sendTransportRef.current = null;
      }
      
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
        recvTransportRef.current = null;
      }
      
      setRemoteStreams({});
      setCallParticipants([]);
      setIsInCall(false);
      setMicEnabled(true);
      setIsSpeaking(false);
      setSpeakingUsers({});
      setCallError(null);
      setUsesFallbackMode(false);
      currentRoomRef.current = null;
      
      if (socket) {
        socket.emit('leave-call', { roomId });
      }
      
      toast.success('Left audio call');
      console.log('Successfully left audio call');
    } catch (error) {
      console.error('Error leaving call:', error);
    }
  };

  const toggleMic = () => {
    if (!localStream) return;
    
    const newMicState = !micEnabled;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = newMicState;
    });
    
    setMicEnabled(newMicState);
    
    if (socket && currentRoomRef.current) {
      socket.emit('toggle-mic', {
        userId: socket.id,
        micEnabled: newMicState,
        roomId: currentRoomRef.current,
      });
    }
    
    toast.success(newMicState ? 'Microphone enabled' : 'Microphone muted');
  };

  const nextPage = () => {
    const totalPages = Math.ceil((callParticipants.length + 1) / PAGE_SIZE);
    setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket || !connected) return;

    const handleCallStarted = async ({ participants, roomId, mediasoupAvailable }) => {
      console.log('Call started with participants:', participants);
      console.log('Mediasoup available:', mediasoupAvailable);
      
      const otherParticipants = participants.filter(p => p.id !== socket.id);
      setCallParticipants(otherParticipants);
      
      if (!mediasoupAvailable) {
        setUsesFallbackMode(true);
      }
    };

    const handleUserJoinedCall = async ({ userId, username, micEnabled, usingFallback }) => {
      console.log('User joined call:', username, usingFallback ? '(fallback mode)' : '(advanced mode)');
      setCallParticipants(prev => {
        const exists = prev.some(p => p.id === userId);
        if (!exists) {
          return [...prev, { id: userId, username, micEnabled, isSpeaking: false, usingFallback }];
        }
        return prev;
      });
    };

    const handleUserLeftCall = ({ userId }) => {
      console.log('User left call:', userId);
      setCallParticipants(prev => prev.filter(p => p.id !== userId));
      
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
      
      setSpeakingUsers(prev => {
        const newSpeaking = { ...prev };
        delete newSpeaking[userId];
        return newSpeaking;
      });

      // Close peer connection in fallback mode
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }
    };

    const handleToggleMic = ({ userId, micEnabled }) => {
      setCallParticipants(prev =>
        prev.map(p => p.id === userId ? { ...p, micEnabled } : p)
      );
    };

    const handleSpeakingStatus = ({ userId, isSpeaking }) => {
      setSpeakingUsers(prev => ({ ...prev, [userId]: isSpeaking }));
    };

    socket.on('call-started', handleCallStarted);
    socket.on('user-joined-call', handleUserJoinedCall);
    socket.on('user-left-call', handleUserLeftCall);
    socket.on('toggle-mic', handleToggleMic);
    socket.on('speaking-status', handleSpeakingStatus);

    return () => {
      socket.off('call-started', handleCallStarted);
      socket.off('user-joined-call', handleUserJoinedCall);
      socket.off('user-left-call', handleUserLeftCall);
      socket.off('toggle-mic', handleToggleMic);
      socket.off('speaking-status', handleSpeakingStatus);
    };
  }, [socket, connected]);

  useEffect(() => {
    return () => {
      if (currentRoomRef.current) {
        leaveCall(currentRoomRef.current);
      }
    };
  }, []);

  const value = {
    localStream,
    remoteStreams,
    callParticipants,
    isInCall,
    micEnabled,
    isSpeaking,
    speakingUsers,
    callError,
    isInitializing,
    usesFallbackMode,
    currentPage,
    PAGE_SIZE,
    startOrJoinCall,
    leaveCall,
    toggleMic,
    nextPage,
    prevPage,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
