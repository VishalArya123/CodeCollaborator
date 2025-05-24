import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

// Get the server URL from environment variables or use default
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

// Create socket context
const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState({}); // Store messages by roomId
  const [typingUsers, setTypingUsers] = useState({});
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Function to add message to specific room
  const addMessage = (roomId, message) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), message]
    }));
  };

  // Function to get messages for specific room
  const getRoomMessages = (roomId) => {
    return messages[roomId] || [];
  };

  // Function to set messages for specific room (for initial load)
  const setRoomMessages = (roomId, roomMessages) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: roomMessages
    }));
  };

  // Function to update typing users for specific room
  const updateTypingUsers = (roomId, username, isTyping) => {
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
  };

  // Function to get typing users for specific room
  const getRoomTypingUsers = (roomId) => {
    return typingUsers[roomId] || [];
  };

  // Function to join a room and request message history
  const joinRoom = (roomId, username) => {
    if (socket && connected) {
      console.log('Joining room:', roomId, 'as:', username);
      socket.emit('join-room', { roomId, username });
      
      // Request message history for this room
      socket.emit('get-room-messages', { roomId });
    }
  };

  // Function to leave a room
  const leaveRoom = (roomId, username) => {
    if (socket && connected) {
      console.log('Leaving room:', roomId);
      socket.emit('leave-room', { roomId, username });
    }
  };

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: false, // Reuse existing connection if possible
    });

    // Set up event listeners
    socketInstance.on('connect', () => {
      console.log('Connected to server with ID:', socketInstance.id);
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt', attemptNumber);
      reconnectAttempts.current = attemptNumber;
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Global message handler - stores messages in context
    socketInstance.on('chat-message', (message) => {
      console.log('Received chat message in context:', message);
      if (message.roomId) {
        addMessage(message.roomId, message);
      }
    });

    // Handle room joined event with message history
    socketInstance.on('room-joined', ({ roomId, messages: roomMessages, users }) => {
      console.log('Room joined:', roomId, 'with', roomMessages?.length || 0, 'messages');
      if (roomMessages && roomMessages.length > 0) {
        setRoomMessages(roomId, roomMessages);
      }
    });

    // Handle message history response
    socketInstance.on('room-messages', ({ roomId, messages: roomMessages }) => {
      console.log('Received room messages:', roomId, roomMessages?.length || 0);
      if (roomMessages) {
        setRoomMessages(roomId, roomMessages);
      }
    });

    // Handle typing indicators globally
    socketInstance.on('user-typing', ({ roomId, username, isTyping }) => {
      updateTypingUsers(roomId, username, isTyping);
    });

    // Handle user leaving
    socketInstance.on('user-left', ({ roomId, username }) => {
      updateTypingUsers(roomId, username, false);
    });

    // Save socket instance
    setSocket(socketInstance);

    // Handle page visibility change to maintain connection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page hidden - maintaining socket connection');
      } else {
        console.log('Page visible - ensuring socket connection');
        if (!socketInstance.connected) {
          socketInstance.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socketInstance.disconnect();
    };
  }, []);

  // Context value
  const value = {
    socket,
    connected,
    messages: messages, // All messages by room
    getRoomMessages,
    addMessage,
    setRoomMessages,
    getRoomTypingUsers,
    updateTypingUsers,
    joinRoom,
    leaveRoom,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};