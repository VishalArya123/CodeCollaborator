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
  const audioElementsRef = useRef({});
  
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

  // FIXED: Enhanced fallback mode with actual WebRTC peer connections
  const initializeFallbackMode = async (roomId) => {
    try {
      console.log('Initializing fallback WebRTC mode for room:', roomId);
      setUsesFallbackMode(true);
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      setLocalStream(stream);
      setupSpeakingDetection(stream);
      
      // Set up WebRTC peer connections for each participant
      setupFallbackPeerConnections(roomId, stream);
      
      return true;
    } catch (error) {
      console.error('Error in fallback mode initialization:', error);
      throw error;
    }
  };

  // FIXED: Set up actual peer-to-peer connections for audio
  const setupFallbackPeerConnections = (roomId, localStream) => {
    console.log('Setting up WebRTC peer connections for fallback mode');
    
    // Listen for ICE candidates and offers from other peers
    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peerConnection = peerConnectionsRef.current[from];
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    });

    socket.on('offer', async ({ from, offer }) => {
      console.log('Received offer from:', from);
      const peerConnection = createPeerConnection(from, roomId);
      
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Add local stream
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
        
        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
          to: from,
          answer: answer,
          roomId
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const peerConnection = peerConnectionsRef.current[from];
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    });
  };

  // FIXED: Create individual peer connections for each user
  const createPeerConnection = (userId, roomId) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    });

    peerConnectionsRef.current[userId] = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate,
          roomId
        });
      }
    };

    // FIXED: Handle incoming audio streams
    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', userId);
      const [remoteStream] = event.streams;
      
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: remoteStream
      }));

      // FIXED: Create audio element and play the stream
      createAudioElement(userId, remoteStream);
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Peer connection with ${userId} state:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        // Attempt to reconnect
        setTimeout(() => {
          if (isInCall) {
            initiatePeerConnection(userId, roomId);
          }
        }, 2000);
      }
    };

    return peerConnection;
  };

  // FIXED: Create and manage audio elements for remote streams
  const createAudioElement = (userId, stream) => {
    // Remove existing audio element if it exists
    if (audioElementsRef.current[userId]) {
      audioElementsRef.current[userId].remove();
    }

    // Create new audio element
    const audio = document.createElement('audio');
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.volume = 1.0;
    
    // Hide the audio element but keep it in DOM for playback
    audio.style.display = 'none';
    document.body.appendChild(audio);
    audioElementsRef.current[userId] = audio;

    console.log('Audio element created for user:', userId);

    // Handle audio play
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      // Retry after user interaction
      const playAudio = () => {
        audio.play().then(() => {
          document.removeEventListener('click', playAudio);
          document.removeEventListener('touchstart', playAudio);
        }).catch(console.error);
      };
      document.addEventListener('click', playAudio);
      document.addEventListener('touchstart', playAudio);
    });
  };

  // FIXED: Initiate peer connection when user joins
  const initiatePeerConnection = async (userId, roomId) => {
    if (!localStream || peerConnectionsRef.current[userId]) return;

    console.log('Initiating peer connection with:', userId);
    const peerConnection = createPeerConnection(userId, roomId);

    try {
      // Add local stream
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('offer', {
        to: userId,
        offer: offer,
        roomId
      });
    } catch (error) {
      console.error('Error creating offer:', error);
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
      
      // Always use fallback mode for now (since mediasoup is having issues)
      await initializeFallbackMode(roomId);
      
      // Notify server about joining call
      socket.emit('start-call', { roomId });
      
      setIsInCall(true);
      toast.success('Joined audio call successfully!');
      
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
      
      // Close all peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        try {
          pc.close();
        } catch (error) {
          console.error('Error closing peer connection:', error);
        }
      });
      peerConnectionsRef.current = {};
      
      // Remove all audio elements
      Object.values(audioElementsRef.current).forEach(audio => {
        try {
          audio.pause();
          audio.remove();
        } catch (error) {
          console.error('Error removing audio element:', error);
        }
      });
      audioElementsRef.current = {};
      
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
      
      const otherParticipants = participants.filter(p => p.id !== socket.id);
      setCallParticipants(otherParticipants);
      
      // FIXED: Initiate peer connections with existing participants
      if (usesFallbackMode && localStream) {
        otherParticipants.forEach(participant => {
          setTimeout(() => {
            initiatePeerConnection(participant.id, roomId);
          }, 1000 + Math.random() * 2000); // Stagger connections
        });
      }
    };

    const handleUserJoinedCall = async ({ userId, username, micEnabled, usingFallback }) => {
      console.log('User joined call:', username);
      setCallParticipants(prev => {
        const exists = prev.some(p => p.id === userId);
        if (!exists) {
          return [...prev, { id: userId, username, micEnabled, isSpeaking: false, usingFallback }];
        }
        return prev;
      });
      
      // FIXED: Initiate peer connection with new user
      if (usesFallbackMode && localStream && userId !== socket.id) {
        setTimeout(() => {
          initiatePeerConnection(userId, currentRoomRef.current);
        }, 1000);
      }
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

      // FIXED: Clean up peer connection and audio element
      if (peerConnectionsRef.current[userId]) {
        peerConnectionsRef.current[userId].close();
        delete peerConnectionsRef.current[userId];
      }

      if (audioElementsRef.current[userId]) {
        audioElementsRef.current[userId].pause();
        audioElementsRef.current[userId].remove();
        delete audioElementsRef.current[userId];
      }
    };

    const handleToggleMic = ({ userId, micEnabled }) => {
      console.log(`User ${userId} ${micEnabled ? 'unmuted' : 'muted'} microphone`);
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
  }, [socket, connected, usesFallbackMode, localStream]);

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
