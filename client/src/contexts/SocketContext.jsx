import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [roomMessages, setRoomMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const socketInstance = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      upgrade: true,
      rememberUpgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxHttpBufferSize: 100e6, // 100MB
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, reconnect manually
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
      reconnectAttempts.current += 1;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Maximum reconnection attempts reached');
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    // Listen for chat messages
    socketInstance.on('chat-message', (message) => {
      setRoomMessages(prev => ({
        ...prev,
        [message.roomId]: [...(prev[message.roomId] || []), message]
      }));
    });

    // Listen for typing events
    socketInstance.on('user-typing', ({ userId, username, isTyping }) => {
      setTypingUsers(prev => {
        const roomTypingUsers = { ...prev };
        
        // Find the room this user belongs to (you might need to track this)
        Object.keys(roomTypingUsers).forEach(roomId => {
          if (isTyping) {
            roomTypingUsers[roomId] = roomTypingUsers[roomId] || [];
            if (!roomTypingUsers[roomId].includes(username)) {
              roomTypingUsers[roomId] = [...roomTypingUsers[roomId], username];
            }
          } else {
            roomTypingUsers[roomId] = (roomTypingUsers[roomId] || []).filter(u => u !== username);
          }
        });
        
        return roomTypingUsers;
      });
    });

    setSocket(socketInstance);

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  // FIXED: Add missing helper functions
  const getRoomMessages = (roomId) => {
    return roomMessages[roomId] || [];
  };

  const getRoomTypingUsers = (roomId) => {
    return typingUsers[roomId] || [];
  };

  const joinRoom = (roomId, username) => {
    if (socket && connected) {
      socket.emit('join-room', { roomId, username });
    }
  };

  const leaveRoom = (roomId, username) => {
    if (socket && connected) {
      socket.emit('leave-room', { roomId, username });
    }
  };

  const value = {
    socket,
    connected,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts,
    getRoomMessages,
    getRoomTypingUsers,
    joinRoom,
    leaveRoom,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
