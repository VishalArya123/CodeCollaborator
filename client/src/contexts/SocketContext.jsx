import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const maxReconnectAttempts = 5;
  const usernameRef = useRef(null);

  // Stable reference for addMessage
  const addMessage = useCallback((roomId, message) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), message]
    }));
  }, []);

  const getRoomMessages = useCallback((roomId) => {
    return messages[roomId] || [];
  }, [messages]);

  const setRoomMessages = useCallback((roomId, roomMessages) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: roomMessages
    }));
  }, []);

  const updateTypingUsers = useCallback((roomId, username, isTyping) => {
    setTypingUsers(prev => {
      const roomTyping = prev[roomId] || [];
      if (isTyping) {
        return {
          ...prev,
          [roomId]: roomTyping.includes(username) ? roomTyping : [...roomTyping, username]
        };
      } else {
        return {
          ...prev,
          [roomId]: roomTyping.filter(user => user !== username)
        };
      }
    });
  }, []);

  const getRoomTypingUsers = useCallback((roomId) => {
    return typingUsers[roomId] || [];
  }, [typingUsers]);

  const joinRoom = useCallback((roomId, username) => {
    if (!socket || !connected || activeRoom === roomId) return;
    
    usernameRef.current = username;
    
    if (activeRoom) {
      leaveRoom(activeRoom, username);
    }

    console.log('Joining room:', roomId, 'as:', username);
    socket.emit('join-room', { roomId, username });
    setActiveRoom(roomId);
    socket.emit('get-room-messages', { roomId });
  }, [socket, connected, activeRoom]);

  const leaveRoom = useCallback((roomId, username) => {
    if (!socket || !connected || !activeRoom) return;
    
    console.log('Leaving room:', roomId);
    socket.emit('leave-room', { roomId, username });
    setActiveRoom(null);
  }, [socket, connected, activeRoom]);

  // Handle reconnection to room
  const handleReconnect = useCallback(() => {
    if (activeRoom && usernameRef.current) {
      console.log('Reconnecting to room:', activeRoom);
      joinRoom(activeRoom, usernameRef.current);
    }
  }, [activeRoom, joinRoom]);

  useEffect(() => {
    const socketInstance = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to server with ID:', socketInstance.id);
      setConnected(true);
      setConnectionState('connected');
      reconnectAttempts.current = 0;
      handleReconnect();
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
      setConnectionState('disconnected');
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        setConnected(true);
        setConnectionState('connected');
        reconnectAttempts.current = 0;
        handleReconnect();
      }, 1000);
    });

    socketInstance.on('reconnecting', (attemptNumber) => {
      console.log('Reconnection attempt', attemptNumber);
      setConnectionState('reconnecting');
      reconnectAttempts.current = attemptNumber;
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      setConnectionState('disconnected');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
      setConnectionState('disconnected');
    });

    socketInstance.on('chat-message', (message) => {
      if (message.roomId) {
        addMessage(message.roomId, message);
      }
    });

    socketInstance.on('room-joined', ({ roomId, messages: roomMessages }) => {
      if (roomMessages?.length > 0) {
        setRoomMessages(roomId, roomMessages);
      }
    });

    socketInstance.on('room-messages', ({ roomId, messages: roomMessages }) => {
      if (roomMessages) {
        setRoomMessages(roomId, roomMessages);
      }
    });

    socketInstance.on('user-typing', ({ roomId, username, isTyping }) => {
      updateTypingUsers(roomId, username, isTyping);
    });

    socketInstance.on('user-left', ({ roomId, username }) => {
      updateTypingUsers(roomId, username, false);
    });

    setSocket(socketInstance);

    return () => {
      clearTimeout(reconnectTimer.current);
      socketInstance.disconnect();
    };
  }, [addMessage, setRoomMessages, updateTypingUsers, handleReconnect]);

  const value = {
    socket,
    connected,
    connectionState,
    messages,
    getRoomMessages,
    addMessage,
    setRoomMessages,
    getRoomTypingUsers,
    updateTypingUsers,
    joinRoom,
    leaveRoom,
    activeRoom,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};