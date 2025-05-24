import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';

const Chat = ({ roomId, username }) => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    // Listen for chat messages (matches server event name)
    const handleChatMessage = (message) => {
      console.log('Received chat message:', message);
      setMessages(prev => {
        // Prevent duplicate messages
        const isDuplicate = prev.some(msg => msg.id === message.id);
        if (isDuplicate) {
          console.log('Duplicate message detected, skipping');
          return prev;
        }
        console.log('Adding new message to state');
        return [...prev, message];
      });
    };

    // Listen for typing indicators
    const handleUserTyping = ({ userId, username: typingUsername, isTyping: typing }) => {
      // Don't show typing indicator for current user
      if (typingUsername === username) return;
      
      setTypingUsers(prev => {
        if (typing) {
          return prev.includes(typingUsername) ? prev : [...prev, typingUsername];
        } else {
          return prev.filter(user => user !== typingUsername);
        }
      });
    };

    // Listen for room joined to get existing messages (if any)
    const handleRoomJoined = ({ messages: existingMessages }) => {
      if (existingMessages && existingMessages.length > 0) {
        setMessages(existingMessages);
      }
    };

    // Listen for user left to remove from typing users
    const handleUserLeft = ({ userId }) => {
      setTypingUsers(prev => prev.filter(user => user !== userId));
    };

    // Add event listeners
    socket.on('chat-message', handleChatMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('room-joined', handleRoomJoined);
    socket.on('user-left', handleUserLeft);

    // Cleanup
    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('room-joined', handleRoomJoined);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, roomId, username]);

  // Handle sending messages
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !roomId) {
      console.log('Message send blocked:', { 
        hasMessage: !!newMessage.trim(), 
        hasSocket: !!socket, 
        hasRoomId: !!roomId 
      });
      return;
    }

    const messageData = {
      roomId,
      message: newMessage.trim(),
      username
    };

    console.log('Sending message:', messageData);

    // Emit message to server (matches server expected format)
    socket.emit('send-message', messageData);
    
    // Clear input
    setNewMessage('');
    
    // Stop typing indicator
    handleStopTyping();
  };

  // Handle typing indicators
  const handleTyping = () => {
    if (!socket || isTyping || !roomId) return;
    
    setIsTyping(true);
    socket.emit('typing', { roomId, username, isTyping: true });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (!socket || !isTyping || !roomId) return;
    
    setIsTyping(false);
    socket.emit('typing', { roomId, username, isTyping: false });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    handleTyping();
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      return '';
    }
  };

  // Generate user color
  const getUserColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 45%)`;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-800">Team Chat</h3>
        <p className="text-sm text-gray-500">Stay connected with your team</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            // Handle system messages
            if (message.sender === 'system') {
              return (
                <div key={message.id || index} className="text-center">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {message.message}
                  </span>
                </div>
              );
            }

            const isCurrentUser = message.sender === username || message.username === username;
            const showUsername = index === 0 || 
              messages[index - 1]?.sender !== message.sender || 
              messages[index - 1]?.username !== message.username;
            
            const messageText = message.message || message.text || '';
            const messageSender = message.sender || message.username || 'Unknown';
            
            return (
              <div key={message.id || index} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                  {showUsername && !isCurrentUser && (
                    <div className="flex items-center mb-1">
                      <span 
                        className="text-xs font-medium"
                        style={{ color: getUserColor(messageSender) }}
                      >
                        {messageSender}
                      </span>
                    </div>
                  )}
                  
                  <div className={`rounded-lg px-3 py-2 ${
                    isCurrentUser 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <p className="text-sm break-words">{messageText}</p>
                    <p className={`text-xs mt-1 ${
                      isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500">
                  {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...` 
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            onBlur={handleStopTyping}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            maxLength={500}
            disabled={!socket || !roomId}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !socket || !roomId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        
        {/* Test button for debugging */}
        <div className="mt-2 flex space-x-2">
          <button
            onClick={() => {
              const testMessage = {
                id: Date.now(),
                sender: username,
                message: 'Test message from client',
                timestamp: new Date().toISOString()
              };
              console.log('Adding test message:', testMessage);
              setMessages(prev => [...prev, testMessage]);
            }}
            className="px-2 py-1 text-xs bg-gray-500 text-white rounded"
          >
            Add Test Message
          </button>
          <button
            onClick={() => {
              console.log('Current messages:', messages);
              console.log('Socket status:', socket?.connected);
              console.log('Room ID:', roomId);
            }}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded"
          >
            Debug Log
          </button>
        </div>
        
        {/* Debug info (always show for debugging) */}
        <div className="mt-2 text-xs text-gray-400 font-mono">
          Socket: {socket ? '✅ Connected' : '❌ Disconnected'} | 
          Room: {roomId || 'None'} | 
          Messages: {messages.length} |
          Username: {username}
        </div>
      </div>
    </div>
  );
};

export default Chat;