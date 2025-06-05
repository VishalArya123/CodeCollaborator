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
      initiator: callerId === socket.id,
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

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from:', userId);
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: remoteStream,
      }));
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
    });

    peer.on('close', () => {
      console.log('Peer connection closed for:', userId);
      if (peersRef.current[userId]) {
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[userId];
        return newStreams;
      });
    });

    return peer;
  };

  // Handle incoming signal
  const handleSignal = ({ userId, signal, callerId }) => {
    let peer = peersRef.current[userId];
    
    if (!peer) {
      peer = createPeer(userId, callerId, localStream);
      peersRef.current[userId] = peer;
    }
    
    try {
      peer.signal(signal);
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  // Start or join a call
  const startOrJoinCall = async (roomId) => {
    if (!socket || !connected || isInCall) return;

    try {
      const stream = await initializeMedia();
      if (!stream) return;

      setIsInCall(true);
      socket.emit('start-call', { roomId });
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  // Properly stop all media tracks
  const stopAllTracks = (stream) => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`Stopped ${track.kind} track:`, track.label);
      });
    }
  };

  // Leave call with proper cleanup
  const leaveCall = (roomId) => {
    if (!isInCall) return;
  
    console.log('Leaving call - stopping all media tracks');
    
    // Stop ALL tracks from local stream
    stopAllTracks(localStream);
    setLocalStream(null);
  
    // Destroy all peers
    Object.values(peersRef.current).forEach(peer => {
      try {
        peer.destroy();
      } catch (error) {
        console.error('Error destroying peer:', error);
      }
    });
    peersRef.current = {};
  
    // Clean up remote streams
    Object.values(remoteStreams).forEach(stream => {
      stopAllTracks(stream);
    });
    setRemoteStreams({});
    
    setCallParticipants([]);
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
      const newMicState = !micEnabled;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = newMicState;
      });
      setMicEnabled(newMicState);
      
      if (socket) {
        socket.emit('toggle-mic', { 
          userId: socket.id, 
          micEnabled: newMicState 
        });
      }
    }
  };

  // Toggle video with proper stream management
  const toggleVideo = async () => {
    if (!localStream) return;

    const newVideoState = !videoEnabled;
    
    if (newVideoState) {
      // Turning video ON - get new video stream
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
        
        // Create new stream with existing audio and new video
        const updatedStream = new MediaStream([currentAudioTrack, newVideoTrack]);
        
        // Update local stream
        setLocalStream(updatedStream);
        
        // Update video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = updatedStream;
        }
        
        // Update all peer connections with new video track
        Object.values(peersRef.current).forEach(peer => {
          try {
            // Replace the video track for all peers
            const sender = peer._pc.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            );
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            }
          } catch (error) {
            console.error('Error replacing video track:', error);
          }
        });
        
        // Stop the temporary stream's audio track
        newStream.getAudioTracks().forEach(track => track.stop());
        
        setVideoEnabled(true);
      } catch (error) {
        console.error('Error enabling video:', error);
        return;
      }
    } else {
      // Turning video OFF - stop video tracks completely
      localStream.getVideoTracks().forEach(track => {
        track.stop();
      });
      
      // Create new stream with only audio
      const audioOnlyStream = new MediaStream(localStream.getAudioTracks());
      setLocalStream(audioOnlyStream);
      
      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = audioOnlyStream;
      }
      
      // Update all peer connections to remove video track
      Object.values(peersRef.current).forEach(peer => {
        try {
          const sender = peer._pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(null);
          }
        } catch (error) {
          console.error('Error removing video track:', error);
        }
      });
      
      setVideoEnabled(false);
    }
    
    if (socket) {
      socket.emit('toggle-video', { 
        userId: socket.id, 
        videoEnabled: newVideoState 
      });
    }
  };

  // Handle socket events
  useEffect(() => {
    if (!socket || !connected) return;

    const handleCallStarted = ({ participants }) => {
      console.log('Call started with participants:', participants);
      setCallParticipants(participants.filter(p => p.id !== socket.id));
      
      // Create peer connections for existing participants
      participants.forEach((participant) => {
        if (participant.id !== socket.id && localStream && !peersRef.current[participant.id]) {
          const peer = createPeer(participant.id, socket.id, localStream);
          peersRef.current[participant.id] = peer;
        }
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
      
      if (userId !== socket.id && localStream && !peersRef.current[userId]) {
        const peer = createPeer(userId, socket.id, localStream);
        peersRef.current[userId] = peer;
      }
    };

    const handleUserLeft = ({ userId }) => {
      console.log('User left call:', userId);
      
      setCallParticipants(prev => prev.filter(p => p.id !== userId));
      
      if (peersRef.current[userId]) {
        try {
          peersRef.current[userId].destroy();
        } catch (error) {
          console.error('Error destroying peer on user leave:', error);
        }
        delete peersRef.current[userId];
      }
      
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
    socket.on('signal', handleSignal);
    socket.on('toggle-mic', handleToggleMic);
    socket.on('toggle-video', handleToggleVideo);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('call-started', handleCallStarted);
      socket.off('user-joined-call', handleUserJoined);
      socket.off('user-left-call', handleUserLeft);
      socket.off('signal', handleSignal);
      socket.off('toggle-mic', handleToggleMic);
      socket.off('toggle-video', handleToggleVideo);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, connected, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('CallProvider cleanup');
      stopAllTracks(localStream);
      Object.values(peersRef.current).forEach(peer => {
        try {
          peer.destroy();
        } catch (error) {
          console.error('Error destroying peer on cleanup:', error);
        }
      });
      Object.values(remoteStreams).forEach(stream => {
        stopAllTracks(stream);
      });
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