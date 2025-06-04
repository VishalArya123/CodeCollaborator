import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001';

const SocketContext = createContext();

export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [users, setUsers] = useState([]); // Added to track users with call status
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const addMessage = (roomId, message) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), message]
    }));
  };

  const getRoomMessages = (roomId) => {
    return messages[roomId] || [];
  };

  const setRoomMessages = (roomId, roomMessages) => {
    setMessages(prev => ({
      ...prev,
      [roomId]: roomMessages
    }));
  };

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

  const getRoomTypingUsers = (roomId) => {
    return typingUsers[roomId] || [];
  };

  const joinRoom = (roomId, username) => {
    if (socket && connected) {
      console.log('Joining room:', roomId, 'as:', username);
      socket.emit('join-room', { roomId, username });
      socket.emit('get-room-messages', { roomId });
    }
  };

  const leaveRoom = (roomId, username) => {
    if (socket && connected) {
      console.log('Leaving room:', roomId);
      socket.emit('leave-room', { roomId, username });
    }
  };

  useEffect(() => {
    const socketInstance = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: false,
    });

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

    socketInstance.on('chat-message', (message) => {
      console.log('Received chat message in context:', message);
      if (message.roomId) {
        addMessage(message.roomId, message);
      }
    });

    socketInstance.on('room-joined', ({ roomId, messages: roomMessages, users: roomUsers, files }) => {
      console.log('Room joined:', roomId, 'with', roomMessages?.length || 0, 'messages');
      if (roomMessages && roomMessages.length > 0) {
        setRoomMessages(roomId, roomMessages);
      }
      setUsers(roomUsers); // Update users with call status
    });

    socketInstance.on('room-messages', ({ roomId, messages: roomMessages }) => {
      console.log('Received room messages:', roomId, roomMessages?.length || 0);
      if (roomMessages) {
        setRoomMessages(roomId, roomMessages);
      }
    });

    socketInstance.on('user-typing', ({ roomId, username, isTyping }) => {
      updateTypingUsers(roomId, username, isTyping);
    });

    socketInstance.on('user-joined', ({ users: roomUsers }) => {
      setUsers(roomUsers);
    });

    socketInstance.on('user-left', ({ users: roomUsers }) => {
      setUsers(roomUsers);
    });

    socketInstance.on('user-joined-call', ({ userId, username, micEnabled, videoEnabled }) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, isInCall: true, micEnabled, videoEnabled }
            : user
        )
      );
    });

    socketInstance.on('user-left-call', ({ userId }) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, isInCall: false } : user
        )
      );
    });

    socketInstance.on('toggle-mic', ({ userId, micEnabled }) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, micEnabled } : user
        )
      );
    });

    socketInstance.on('toggle-video', ({ userId, videoEnabled }) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, videoEnabled } : user
        )
      );
    });

    setSocket(socketInstance);

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

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socketInstance.disconnect();
    };
  }, []);

  const value = {
    socket,
    connected,
    messages,
    getRoomMessages,
    addMessage,
    setRoomMessages,
    getRoomTypingUsers,
    updateTypingUsers,
    joinRoom,
    leaveRoom,
    users,
    reconnectAttempts: reconnectAttempts.current,
    maxReconnectAttempts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};