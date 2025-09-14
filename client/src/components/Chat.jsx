import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { 
  FaPaperPlane, 
  FaSmile, 
  FaPaperclip, 
  FaImage, 
  FaFile,
  FaReply,
  FaTrash,
  FaSearch,
  FaUsers,
  FaAt
} from 'react-icons/fa';

const Chat = ({ roomId, username }) => {
  const { 
    socket, 
    connected,
    getRoomMessages, 
    getRoomTypingUsers, 
    joinRoom, 
    leaveRoom 
  } = useSocket();
  
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const hasJoinedRoom = useRef(false);
  const currentRoom = useRef(null);
  const currentUsername = useRef(null);
  const isInitialized = useRef(false);
  const messageInputRef = useRef(null);

  const messages = getRoomMessages(roomId);
  const typingUsers = getRoomTypingUsers(roomId);

  const filteredMessages = searchQuery.trim() 
    ? messages.filter(msg => 
        msg.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleJoinRoom = useCallback((roomId, username) => {
    if (!socket || !connected || !roomId || !username) {
      console.log('Cannot join room - missing requirements:', { socket: !!socket, connected, roomId, username });
      return;
    }

    console.log('Joining room:', roomId, 'as:', username);
    joinRoom(roomId, username);
    hasJoinedRoom.current = true;
    currentRoom.current = roomId;
    currentUsername.current = username;
  }, [socket, connected, joinRoom]);

  const handleLeaveRoom = useCallback((roomId, username) => {
    if (!hasJoinedRoom.current || !roomId || !username) return;

    console.log('Leaving room:', roomId);
    leaveRoom(roomId, username);
    hasJoinedRoom.current = false;
    currentRoom.current = null;
    currentUsername.current = null;
  }, [leaveRoom]);

  useEffect(() => {
    if (!socket || !roomId || !username) {
      console.log('Missing basic requirements:', { socket: !!socket, roomId, username });
      return;
    }

    if (!connected) {
      console.log('Not connected, waiting...');
      return;
    }

    const needsRoomSwitch = currentRoom.current && currentRoom.current !== roomId;
    const needsUsernameSwitch = currentUsername.current && currentUsername.current !== username;
    const needsToJoin = !hasJoinedRoom.current;

    if (needsRoomSwitch || needsUsernameSwitch) {
      console.log('Switching rooms/username - leaving current room');
      handleLeaveRoom(currentRoom.current, currentUsername.current);
    }

    if (needsToJoin || needsRoomSwitch || needsUsernameSwitch) {
      console.log('Joining room - reason:', { 
        needsToJoin, 
        needsRoomSwitch, 
        needsUsernameSwitch 
      });
      handleJoinRoom(roomId, username);
    }

    isInitialized.current = true;

    return () => {
      if (hasJoinedRoom.current && currentRoom.current && currentUsername.current) {
        console.log('Component unmounting or dependencies changing - leaving room');
        handleLeaveRoom(currentRoom.current, currentUsername.current);
      }
    };
  }, [socket, connected, roomId, username]);

  useEffect(() => {
    if (!isInitialized.current || !connected || !roomId || !username) {
      return;
    }

    if (currentRoom.current === roomId && 
        currentUsername.current === username && 
        !hasJoinedRoom.current) {
      
      console.log('Reconnected - rejoining room:', roomId);
      handleJoinRoom(roomId, username);
    }
  }, [connected]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !roomId || !connected) {
      console.log('Message send blocked:', { 
        hasMessage: !!newMessage.trim(), 
        hasSocket: !!socket, 
        hasRoomId: !!roomId,
        connected: connected
      });
      return;
    }

    const messageData = {
      roomId,
      message: newMessage.trim(),
      username,
      timestamp: new Date().toISOString(),
      replyTo: replyingTo?.id || null,
      type: 'text'
    };

    console.log('Sending message:', messageData);
    socket.emit('send-message', messageData);
    
    setNewMessage('');
    setReplyingTo(null);
    handleStopTyping();
    messageInputRef.current?.focus();
  };

  const handleTyping = useCallback(() => {
    if (!socket || isTyping || !roomId || !connected) return;
    
    setIsTyping(true);
    socket.emit('typing', { roomId, username, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 2000);
  }, [socket, isTyping, roomId, connected, username]);

  const handleStopTyping = useCallback(() => {
    if (!socket || !isTyping || !roomId) return;
    
    setIsTyping(false);
    socket.emit('typing', { roomId, username, isTyping: false });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [socket, isTyping, roomId, username]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (connected) {
      handleTyping();
    }
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    messageInputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } else {
        return date.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      return '';
    }
  };

  const getUserColor = (username) => {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  };

  const getUserInitials = (username) => {
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Chat Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FaUsers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Team Chat</h3>
              <p className="text-indigo-100 text-sm">
                Stay connected with your team
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${
                showSearch 
                  ? 'bg-white/20 text-white' 
                  : 'text-indigo-100 hover:bg-white/10'
              }`}
              title="Search messages"
            >
              <FaSearch className="w-4 h-4" />
            </button>
            
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs ${
              connected 
                ? 'bg-green-500/20 text-green-100' 
                : 'bg-red-500/20 text-red-100'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-300' : 'bg-red-300'
              }`}></div>
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="mt-3 relative">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-indigo-200 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-800">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaUsers className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              {searchQuery ? 'No messages found' : 'No messages yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
              {searchQuery 
                ? `No messages match "${searchQuery}"`
                : 'Start the conversation! Send your first message to the team.'
              }
            </p>
          </div>
        ) : (
          filteredMessages.map((message, index) => {
            if (message.sender === 'system') {
              return (
                <div key={message.id || index} className="flex justify-center">
                  <div className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-full text-xs font-medium">
                    {message.message}
                  </div>
                </div>
              );
            }

            const isCurrentUser = message.sender === username || message.username === username;
            const showAvatar = index === 0 || 
              filteredMessages[index - 1]?.sender !== message.sender || 
              filteredMessages[index - 1]?.username !== message.username;
            
            const messageText = message.message || message.text || '';
            const messageSender = message.sender || message.username || 'Unknown';
            const userColor = getUserColor(messageSender);
            
            return (
              <div key={message.id || index} className={`flex group ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-xs lg:max-w-md ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
                  {!isCurrentUser && (
                    <div className={`flex-shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                        style={{ backgroundColor: userColor }}
                      >
                        {getUserInitials(messageSender)}
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex-1 ${isCurrentUser ? 'mr-2' : 'ml-2'}`}>
                    {showAvatar && !isCurrentUser && (
                      <div className="flex items-center mb-1">
                        <span 
                          className="text-sm font-semibold"
                          style={{ color: userColor }}
                        >
                          {messageSender}
                        </span>
                      </div>
                    )}
                    
                    {message.replyTo && (
                      <div className="mb-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Replying to {filteredMessages.find(m => m.id === message.replyTo)?.sender || 'message'}
                        </div>
                      </div>
                    )}
                    
                    <div className={`relative rounded-2xl px-4 py-2 shadow-sm ${
                      isCurrentUser 
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white' 
                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600'
                    }`}>
                      <p className="text-sm leading-relaxed break-words">{messageText}</p>
                      
                      <div className={`absolute top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isCurrentUser ? '-left-8' : '-right-8'
                      }`}>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleReply(message)}
                            className="p-1 bg-white dark:bg-slate-800 rounded-full shadow-md hover:shadow-lg transition-shadow text-slate-500 hover:text-indigo-500"
                            title="Reply"
                          >
                            <FaReply className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`text-xs text-slate-500 dark:text-slate-400 mt-1 ${
                      isCurrentUser ? 'text-right' : 'text-left'
                    }`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-2xl px-4 py-2 shadow-sm border border-slate-200 dark:border-slate-600">
                <span className="text-sm text-slate-600 dark:text-slate-400">
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
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        {replyingTo && (
          <div className="mb-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Replying to {replyingTo.sender || replyingTo.username}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 truncate">
                  {replyingTo.message}
                </div>
              </div>
              <button
                onClick={cancelReply}
                className="ml-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={messageInputRef}
              value={newMessage}
              onChange={handleInputChange}
              onBlur={handleStopTyping}
              placeholder={connected ? "Type your message..." : "Connecting..."}
              className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
              rows={1}
              maxLength={500}
              disabled={!socket || !roomId || !connected}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            
            <div className="absolute bottom-2 right-3 text-xs text-slate-400">
              {newMessage.length}/500
            </div>
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || !socket || !roomId || !connected}
            className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <FaPaperPlane className="w-4 h-4" />
          </button>
        </form>
        
        {!connected && (
          <div className="mt-3 text-center">
            <span className="inline-flex items-center space-x-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>Disconnected - Trying to reconnect...</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
