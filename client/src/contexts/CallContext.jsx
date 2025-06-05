import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import * as mediasoupClient from 'mediasoup-client';

// Utility for Socket.IO request-response pattern
const socketRequest = (socket, event, data) => {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (response) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
};

const CallContext = createContext();

export const useCall = () => {
  return useContext(CallContext);
};

export const CallProvider = ({ children }) => {
  const { socket, connected } = useSocket();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [callParticipants, setCallParticipants] = useState([]);
  const [isInCall, setIsInCall] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const peersRef = useRef({});
  const localVideoRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef({});
  const PAGE_SIZE = 4; // Show 4 participants per page

  // Initialize mediasoup device
  const initializeDevice = async () => {
    if (!socket || !connected) return;
    try {
      deviceRef.current = new mediasoupClient.Device();
      
      const routerRtpCapabilities = await socketRequest(socket, 'getRouterRtpCapabilities', { 
        roomId: Array.from(socket.rooms || new Set()).find(room => room !== socket.id)
      });
      
      await deviceRef.current.load({ routerRtpCapabilities });
    } catch (error) {
      console.error('Error initializing mediasoup device:', error);
    }
  };

  // Create transports
  const createTransports = async () => {
    if (!socket || !connected) return;
    try {
      const roomId = Array.from(socket.rooms || new Set()).find(room => room !== socket.id);
      if (!roomId) throw new Error('No room joined');

      // Create send transport
      const sendTransportData = await socketRequest(socket, 'createWebRtcTransport', { roomId });
      
      sendTransportRef.current = deviceRef.current.createSendTransport(sendTransportData);
      
      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketRequest(socket, 'connectTransport', {
            transportId: sendTransportRef.current.id,
            dtlsParameters,
            roomId
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });
      
      sendTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await socketRequest(socket, 'produce', {
            transportId: sendTransportRef.current.id,
            kind,
            rtpParameters,
            roomId
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Create receive transport
      const recvTransportData = await socketRequest(socket, 'createWebRtcTransport', { roomId });
      
      recvTransportRef.current = deviceRef.current.createRecvTransport(recvTransportData);
      
      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketRequest(socket, 'connectTransport', {
            transportId: recvTransportRef.current.id,
            dtlsParameters,
            roomId
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });
    } catch (error) {
      console.error('Error creating transports:', error);
    }
  };

  // Produce local media
  const produceMedia = async () => {
    if (!localStream || !sendTransportRef.current) return;
    
    try {
      // Produce audio
      if (localStream.getAudioTracks().length > 0) {
        const audioTrack = localStream.getAudioTracks()[0];
        const audioProducer = await sendTransportRef.current.produce({
          track: audioTrack,
          codecOptions: {
            opusStereo: true,
            opusDtx: true
          }
        });
        producersRef.current.audio = audioProducer;
      }
      
      // Produce video
      if (localStream.getVideoTracks().length > 0) {
        const videoTrack = localStream.getVideoTracks()[0];
        const videoProducer = await sendTransportRef.current.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 1000000 },
            { maxBitrate: 500000 },
            { maxBitrate: 250000 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          }
        });
        producersRef.current.video = videoProducer;
      }
    } catch (error) {
      console.error('Error producing media:', error);
    }
  };

  // Consume remote media
  const consumeMedia = async (userId) => {
    if (!recvTransportRef.current || !socket || !connected) return;
    
    try {
      const roomId = Array.from(socket.rooms || new Set()).find(room => room !== socket.id);
      if (!roomId) throw new Error('No room joined');

      const { producers } = await socketRequest(socket, 'getProducers', { userId, roomId });
      
      const stream = new MediaStream();
      
      for (const producer of producers) {
        const { id, kind } = producer;
        
        const consumer = await recvTransportRef.current.consume({
          producerId: id,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
          paused: kind === 'video'
        });
        
        consumersRef.current[`${userId}-${kind}`] = consumer;
        
        stream.addTrack(consumer.track);
        
        if (kind === 'video') {
          await socketRequest(socket, 'resumeConsumer', { consumerId: consumer.id, roomId });
        }
      }
      
      setRemoteStreams(prev => ({
        ...prev,
        [userId]: stream
      }));
    } catch (error) {
      console.error('Error consuming media:', error);
    }
  };

  // Initialize local media stream
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      return null;
    }
  };

  // Properly stop all media tracks
  const stopAllTracks = (stream) => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  };

  // Start or join a call
  const startOrJoinCall = async (roomId) => {
    if (!socket || !connected || isInCall) return;
  
    try {
      let stream = localStream;
      if (!stream) {
        stream = await initializeMedia();
        if (!stream) return;
      }
  
      setIsInCall(true);
      
      // Initialize mediasoup
      await initializeDevice();
      await createTransports();
      await produceMedia();
      
      socket.emit('start-call', { roomId });
      
      console.log('Joined call in room:', roomId);
    } catch (error) {
      console.error('Error starting call:', error);
      setIsInCall(false);
    }
  };

  // Leave call with proper cleanup
  const leaveCall = (roomId) => {
    if (!isInCall) return;
  
    // Stop all local tracks
    if (localStream) {
      stopAllTracks(localStream);
      setLocalStream(null);
    }
  
    // Close all producers and consumers
    Object.values(producersRef.current).forEach(producer => {
      try {
        producer.close();
      } catch (error) {
        console.error('Error closing producer:', error);
      }
    });
    
    Object.values(consumersRef.current).forEach(consumer => {
      try {
        consumer.close();
      } catch (error) {
        console.error('Error closing consumer:', error);
      }
    });
    
    producersRef.current = {};
    consumersRef.current = {};
    
    // Close transports
    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }
    
    // Clean up remote streams
    Object.values(remoteStreams).forEach(stream => {
      stopAllTracks(stream);
    });
    setRemoteStreams({});
    
    setCallParticipants([]);
    setIsInCall(false);
    setMicEnabled(true);
    setVideoEnabled(true);
  
    if (socket && connected) {
      socket.emit('leave-call', { roomId });
    }
  };

  // Toggle microphone
  const toggleMic = () => {
    if (!localStream || !socket || !connected) return;
    
    const newMicState = !micEnabled;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = newMicState;
    });
    setMicEnabled(newMicState);
    
    const roomId = Array.from(socket.rooms || new Set()).find(room => room !== socket.id);
    if (roomId && socket) {
      socket.emit('toggle-mic', { 
        userId: socket.id, 
        micEnabled: newMicState,
        roomId
      });
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (!localStream || !socket || !connected) return;

    const newVideoState = !videoEnabled;
    const roomId = Array.from(socket.rooms || new Set()).find(room => room !== socket.id);
    if (!roomId) return;

    if (newVideoState) {
      // Turning video ON
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        
        // Stop old video tracks
        localStream.getVideoTracks().forEach(track => track.stop());
        
        // Get new tracks
        const newVideoTrack = newStream.getVideoTracks()[0];
        const currentAudioTrack = localStream.getAudioTracks()[0];
        
        // Create new stream
        const updatedStream = new MediaStream([currentAudioTrack, newVideoTrack]);
        setLocalStream(updatedStream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = updatedStream;
        }
        
        // Replace video producer
        if (producersRef.current.video) {
          producersRef.current.video.close();
          delete producersRef.current.video;
        }
        
        if (sendTransportRef.current) {
          const videoProducer = await sendTransportRef.current.produce({
            track: newVideoTrack,
            encodings: [
              { maxBitrate: 1000000 },
              { maxBitrate: 500000 },
              { maxBitrate: 250000 }
            ],
            codecOptions: {
              videoGoogleStartBitrate: 1000
            }
          });
          producersRef.current.video = videoProducer;
        }
        
        // Clean up
        newStream.getAudioTracks().forEach(track => track.stop());
        
        setVideoEnabled(true);
      } catch (error) {
        console.error('Error enabling video:', error);
        return;
      }
    } else {
      // Turning video OFF
      localStream.getVideoTracks().forEach(track => track.stop());
      
      const audioOnlyStream = new MediaStream(localStream.getAudioTracks());
      setLocalStream(audioOnlyStream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = audioOnlyStream;
      }
      
      // Close video producer
      if (producersRef.current.video) {
        producersRef.current.video.close();
        delete producersRef.current.video;
      }
      
      setVideoEnabled(false);
    }
    
    if (socket && roomId) {
      socket.emit('toggle-video', { 
        userId: socket.id, 
        videoEnabled: newVideoState,
        roomId
      });
    }
  };

  // Handle socket events
  useEffect(() => {
    if (!socket || !connected) return;

    const handleCallStarted = ({ participants, roomId }) => {
      console.log('Call started with participants:', participants);
      const otherParticipants = participants.filter(p => p.id !== socket.id);
      setCallParticipants(otherParticipants);
      
      // Consume media from existing participants
      otherParticipants.forEach(async (participant) => {
        await consumeMedia(participant.id);
      });
    };

    const handleUserJoined = ({ userId, username }) => {
      console.log('User joined call:', username);
      
      setCallParticipants(prev => {
        const exists = prev.some(p => p.id === userId);
        if (!exists) {
          return [...prev, { id: userId, username, micEnabled: true, videoEnabled: true }];
        }
        return prev;
      });
      
      if (userId !== socket.id) {
        consumeMedia(userId);
      }
    };

    const handleUserLeft = ({ userId }) => {
      console.log('User left call:', userId);
      
      setCallParticipants(prev => prev.filter(p => p.id !== userId));
      
      // Close consumers for this user
      Object.keys(consumersRef.current)
        .filter(key => key.startsWith(`${userId}-`))
        .forEach(key => {
          consumersRef.current[key].close();
          delete consumersRef.current[key];
        });
      
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    };

    const handleToggleMic = ({ userId, micEnabled }) => {
      setCallParticipants(prev =>
        prev.map(p => p.id === userId ? { ...p, micEnabled } : p)
      );
    };

    const handleToggleVideo = ({ userId, videoEnabled }) => {
      setCallParticipants(prev =>
        prev.map(p => p.id === userId ? { ...p, videoEnabled } : p)
      );
    };

    const handleCallEnded = () => {
      console.log('Call ended by server');
      leaveCall();
    };

    socket.on('call-started', handleCallStarted);
    socket.on('user-joined-call', handleUserJoined);
    socket.on('user-left-call', handleUserLeft);
    socket.on('toggle-mic', handleToggleMic);
    socket.on('toggle-video', handleToggleVideo);
    socket.on('call-ended', handleCallEnded);
    socket.on('new-producer', ({ userId }) => {
      if (userId !== socket.id) {
        consumeMedia(userId);
      }
    });

    return () => {
      socket.off('call-started', handleCallStarted);
      socket.off('user-joined-call', handleUserJoined);
      socket.off('user-left-call', handleUserLeft);
      socket.off('toggle-mic', handleToggleMic);
      socket.off('toggle-video', handleToggleVideo);
      socket.off('call-ended', handleCallEnded);
      socket.off('new-producer');
    };
  }, [socket, connected, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        stopAllTracks(localStream);
      }
      
      // Close all producers and consumers
      Object.values(producersRef.current).forEach(producer => {
        try {
          producer.close();
        } catch (error) {
          console.error('Error closing producer:', error);
        }
      });
      
      Object.values(consumersRef.current).forEach(consumer => {
        try {
          consumer.close();
        } catch (error) {
          console.error('Error closing consumer:', error);
        }
      });
      
      // Close transports
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
      }
      
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
      }
      
      // Clean up remote streams
      Object.values(remoteStreams).forEach(stream => {
        stopAllTracks(stream);
      });
    };
  }, []);

  // Pagination functions
  const nextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, Math.ceil(callParticipants.length / PAGE_SIZE) - 1));
  };

  const prevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  const value = {
    localStream,
    remoteStreams,
    callParticipants,
    isInCall,
    micEnabled,
    videoEnabled,
    localVideoRef,
    currentPage,
    PAGE_SIZE,
    startOrJoinCall,
    leaveCall,
    toggleMic,
    toggleVideo,
    nextPage,
    prevPage,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};