import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import * as mediasoupClient from 'mediasoup-client';
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
  
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef({});
  const audioAnalyserRef = useRef(null);
  const currentRoomRef = useRef(null);
  
  const PAGE_SIZE = 4;
  const [currentPage, setCurrentPage] = useState(0);

  // FIXED: Increased timeout for mediasoup operations
  const socketRequest = (event, data, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      if (!socket || !connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log(`Making socket request: ${event}`, data);

      const timer = setTimeout(() => {
        reject(new Error(`Socket request timeout: ${event} (${timeout}ms)`));
      }, timeout);

      socket.emit(event, data, (response) => {
        clearTimeout(timer);
        console.log(`Socket response for ${event}:`, response);
        
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  };

  const initializeDevice = async (roomId) => {
    try {
      if (deviceRef.current && deviceRef.current.loaded) {
        console.log('Device already initialized');
        return deviceRef.current;
      }

      console.log('Initializing mediasoup device for room:', roomId);
      deviceRef.current = new mediasoupClient.Device();
      
      // FIXED: Add retry logic for getting RTP capabilities
      let retries = 3;
      let routerRtpCapabilities;
      
      while (retries > 0) {
        try {
          console.log(`Attempting to get RTP capabilities (${retries} retries left)`);
          routerRtpCapabilities = await socketRequest('getRouterRtpCapabilities', { roomId }, 15000);
          break;
        } catch (error) {
          retries--;
          console.log(`RTP capabilities request failed, ${retries} retries left:`, error.message);
          
          if (retries === 0) {
            throw new Error('Failed to get router capabilities after multiple attempts');
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      await deviceRef.current.load({ routerRtpCapabilities });
      
      console.log('Mediasoup device initialized successfully');
      return deviceRef.current;
    } catch (error) {
      console.error('Error initializing mediasoup device:', error);
      setCallError(`Failed to initialize audio device: ${error.message}`);
      throw error;
    }
  };

  const createTransports = async (roomId) => {
    try {
      console.log('Creating WebRTC transports for room:', roomId);
      
      // Create send transport
      const sendTransportData = await socketRequest('createWebRtcTransport', { roomId }, 15000);
      sendTransportRef.current = deviceRef.current.createSendTransport(sendTransportData);

      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('Connecting send transport...');
          await socketRequest('connectTransport', {
            transportId: sendTransportRef.current.id,
            dtlsParameters,
            roomId,
          }, 15000);
          callback();
          console.log('Send transport connected successfully');
        } catch (error) {
          console.error('Send transport connect error:', error);
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          console.log(`Producing ${kind} media...`);
          const { id } = await socketRequest('produce', {
            transportId: sendTransportRef.current.id,
            kind,
            rtpParameters,
            roomId,
          }, 15000);
          callback({ id });
          console.log(`Producer created with ID: ${id}`);
        } catch (error) {
          console.error('Produce error:', error);
          errback(error);
        }
      });

      // Create receive transport
      const recvTransportData = await socketRequest('createWebRtcTransport', { roomId }, 15000);
      recvTransportRef.current = deviceRef.current.createRecvTransport(recvTransportData);

      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('Connecting receive transport...');
          await socketRequest('connectTransport', {
            transportId: recvTransportRef.current.id,
            dtlsParameters,
            roomId,
          }, 15000);
          callback();
          console.log('Receive transport connected successfully');
        } catch (error) {
          console.error('Recv transport connect error:', error);
          errback(error);
        }
      });

      console.log('Transports created successfully');
    } catch (error) {
      console.error('Error creating transports:', error);
      setCallError(`Failed to set up audio connection: ${error.message}`);
      throw error;
    }
  };

  const initializeMedia = async () => {
    try {
      if (localStream) {
        console.log('Media stream already exists');
        return localStream;
      }

      console.log('Requesting user media...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
        },
      });

      setLocalStream(stream);
      setupSpeakingDetection(stream);
      
      console.log('Local media stream initialized');
      return stream;
    } catch (error) {
      console.error('Error accessing audio devices:', error);
      setCallError('Failed to access microphone. Please check permissions and try again.');
      throw error;
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
        if (!audioAnalyserRef.current) return;
        
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

  const produceMedia = async () => {
    if (!localStream || !sendTransportRef.current) return;
    
    try {
      console.log('Producing local audio...');
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true,
          },
        });
        
        producersRef.current.audio = audioProducer;
        
        audioProducer.on('transportclose', () => {
          console.log('Audio producer transport closed');
        });

        audioProducer.on('trackended', () => {
          console.log('Audio producer track ended');
        });
        
        console.log('Audio producer created successfully');
      }
    } catch (error) {
      console.error('Error producing audio:', error);
      setCallError(`Failed to share audio: ${error.message}`);
    }
  };

  const startOrJoinCall = async (roomId) => {
    if (isInCall || isInitializing) return;
    
    setIsInitializing(true);
    setCallError(null);
    currentRoomRef.current = roomId;
    
    try {
      console.log('Starting/joining call in room:', roomId);
      
      // Check if mediasoup is available
      if (!mediasoupClient) {
        throw new Error('MediaSoup client not available');
      }
      
      const stream = await initializeMedia();
      await initializeDevice(roomId);
      await createTransports(roomId);
      await produceMedia();
      
      // Notify server about joining call
      socket.emit('start-call', { roomId });
      
      setIsInCall(true);
      toast.success('Joined audio call successfully!');
      
      console.log('Successfully joined audio call');
    } catch (error) {
      console.error('Error starting/joining call:', error);
      setCallError(error.message || 'Failed to join audio call');
      toast.error(`Failed to join audio call: ${error.message}`);
      
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

    const handleCallStarted = async ({ participants, roomId }) => {
      console.log('Call started with participants:', participants);
      const otherParticipants = participants.filter(p => p.id !== socket.id);
      setCallParticipants(otherParticipants);
    };

    const handleUserJoinedCall = async ({ userId, username, micEnabled }) => {
      console.log('User joined call:', username);
      setCallParticipants(prev => {
        const exists = prev.some(p => p.id === userId);
        if (!exists) {
          return [...prev, { id: userId, username, micEnabled, isSpeaking: false }];
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
