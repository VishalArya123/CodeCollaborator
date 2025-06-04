import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import SimplePeer from 'simple-peer';

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
  const peersRef = useRef({});
  const localVideoRef = useRef(null);

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

  // Create a peer connection
  const createPeer = (userId, callerId, stream) => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (data) => {
      socket.emit('signal', { userId, callerId, signal: data });
    });

    peer.on('stream', (stream) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: stream,
      }));
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    return peer;
  };

  // Handle incoming signal
  const handleSignal = ({ userId, signal, callerId }) => {
    if (peersRef.current[userId]) {
      peersRef.current[userId].signal(signal);
    } else {
      const stream = localStream;
      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peer.on('signal', (data) => {
        socket.emit('signal', { userId: callerId, callerId: socket.id, signal: data });
      });

      peer.on('stream', (stream) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [userId]: stream,
        }));
      });

      peer.on('error', (err) => {
        console.error('Peer connection error:', err);
      });

      peersRef.current[userId] = peer;
      peer.signal(signal);
    }
  };

  // Start or join a call
  const startOrJoinCall = async (roomId) => {
    if (!socket || !connected || isInCall) return;

    const stream = await initializeMedia();
    if (!stream) return;

    setIsInCall(true);
    socket.emit('start-call', { roomId });
  };

  // Leave call
  const leaveCall = (roomId) => {
    if (!isInCall) return;
  
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  
    // Destroy all peers
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
  
    setLocalStream(null);
    setRemoteStreams({});
    setIsInCall(false);
    setMicEnabled(true);
    setVideoEnabled(true);
  
    if (socket) {
      socket.emit('leave-call', { roomId });
    }
  };

  // Toggle microphone
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
      socket.emit('toggle-mic', { userId: socket.id, micEnabled: !micEnabled });
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !videoEnabled;
      });
      setVideoEnabled(!videoEnabled);
      socket.emit('toggle-video', { userId: socket.id, videoEnabled: !videoEnabled });
    }
  };

  // Handle socket events
  useEffect(() => {
    if (!socket || !connected) return;

    socket.on('call-started', ({ roomId, participants }) => {
      setCallParticipants(participants);
      participants.forEach((userId) => {
        if (userId !== socket.id && localStream) {
          const peer = createPeer(userId, socket.id, localStream);
          peersRef.current[userId] = peer;
        }
      });
    });

    socket.on('user-joined-call', ({ userId, username, micEnabled, videoEnabled }) => {
      setCallParticipants((prev) => [...prev, { id: userId, username, micEnabled, videoEnabled }]);
      if (localStream && userId !== socket.id) {
        const peer = createPeer(userId, socket.id, localStream);
        peersRef.current[userId] = peer;
      }
    });

    socket.on('user-left-call', ({ userId }) => {
      setCallParticipants((prev) => prev.filter((p) => p.id !== userId));
      if (peersRef.current[userId]) {
        peersRef.current[userId].destroy();
        delete peersRef.current[userId];
      }
      setRemoteStreams((prev) => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    });

    socket.on('signal', handleSignal);

    socket.on('toggle-mic', ({ userId, micEnabled }) => {
      setCallParticipants((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, micEnabled } : p))
      );
    });

    socket.on('toggle-video', ({ userId, videoEnabled }) => {
      setCallParticipants((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, videoEnabled } : p))
      );
    });

    return () => {
      socket.off('call-started');
      socket.off('user-joined-call');
      socket.off('user-left-call');
      socket.off('signal');
      socket.off('toggle-mic');
      socket.off('toggle-video');
    };
  }, [socket, connected, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
    };
  }, []);

  const value = {
    localStream,
    remoteStreams,
    callParticipants,
    isInCall,
    micEnabled,
    videoEnabled,
    localVideoRef,
    startOrJoinCall,
    leaveCall,
    toggleMic,
    toggleVideo,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};