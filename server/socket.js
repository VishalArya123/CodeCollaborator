// Store active rooms and users
const rooms = new Map();

/**
 * Sets up socket server with all event handlers
 * @param {Object} io - Socket.io server instance
 */
function setupSocketServer(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a room
    socket.on('join-room', ({ roomId, username }) => {
      console.log(`User ${username} (${socket.id}) joining room: ${roomId}`);
      
      // Leave any existing rooms first
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      socket.join(roomId);

      // Initialize room data if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: [],
          messages: [], // Store chat messages
          code: {
            html: '',
            css: '',
            js: ''
          },
          activeUsers: 0,
          createdAt: new Date()
        });
      }

      const roomData = rooms.get(roomId);

      // Check if user is already in the room (reconnection case)
      const existingUserIndex = roomData.users.findIndex(user => user.id === socket.id);
      
      if (existingUserIndex === -1) {
        // Add new user to room
        const user = {
          id: socket.id,
          username,
          joinedAt: new Date()
        };

        roomData.users.push(user);
        roomData.activeUsers += 1;

        // Create join message
        const joinMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} has joined the room`,
          timestamp: new Date().toISOString(),
          roomId
        };

        // Store the message
        roomData.messages.push(joinMessage);

        // Notify other users about the new user
        socket.to(roomId).emit('user-joined', {
          user,
          users: roomData.users
        });

        // Send system message to all users in room
        io.to(roomId).emit('chat-message', joinMessage);
      } else {
        // User is reconnecting, update their socket ID
        roomData.users[existingUserIndex].id = socket.id;
        roomData.users[existingUserIndex].reconnectedAt = new Date();
      }

      // Emit welcome message to the user (always send current state)
      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        messages: roomData.messages, // Send message history
        code: roomData.code
      });

      console.log(`Room ${roomId} now has ${roomData.users.length} users`);
    });

    // Handle request for room messages (for reconnection/tab switching)
    socket.on('get-room-messages', ({ roomId }) => {
      console.log(`User ${socket.id} requesting messages for room: ${roomId}`);
      
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        socket.emit('room-messages', {
          roomId,
          messages: roomData.messages
        });
      } else {
        socket.emit('room-messages', {
          roomId,
          messages: []
        });
      }
    });

    // Handle code changes
    socket.on('code-change', ({ roomId, language, code }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        roomData.code[language] = code;

        // Broadcast code changes to all users in the room except sender
        socket.to(roomId).emit('code-update', {
          language,
          code
        });
      }
    });

    // Handle cursor position updates
    socket.on('cursor-position', ({ roomId, position, username }) => {
      socket.to(roomId).emit('cursor-update', {
        userId: socket.id,
        username,
        position
      });
    });

    // Handle chat messages
    socket.on('send-message', ({ roomId, message, username, timestamp }) => {
      console.log(`Message from ${username} in room ${roomId}: ${message}`);
      
      if (!rooms.has(roomId)) {
        console.log(`Room ${roomId} not found, cannot send message`);
        return;
      }

      const roomData = rooms.get(roomId);
      
      // Create message object
      const messageData = {
        id: `${Date.now()}-${socket.id}`,
        sender: username,
        username: username, // Add both for compatibility
        userId: socket.id,
        message: message.trim(),
        timestamp: timestamp || new Date().toISOString(),
        roomId
      };

      // Store message in room
      roomData.messages.push(messageData);

      // Keep only last 1000 messages per room to prevent memory issues
      if (roomData.messages.length > 1000) {
        roomData.messages = roomData.messages.slice(-1000);
      }

      console.log(`Broadcasting message to room ${roomId}, room has ${roomData.users.length} users`);
      
      // Broadcast to ALL users in the room (including sender for confirmation)
      io.to(roomId).emit('chat-message', messageData);
    });

    // Handle user typing in chat
    socket.on('typing', ({ roomId, username, isTyping }) => {
      socket.to(roomId).emit('user-typing', {
        userId: socket.id,
        username,
        isTyping
      });
    });

    // Handle explicit room leaving
    socket.on('leave-room', ({ roomId, username }) => {
      console.log(`User ${username} explicitly leaving room: ${roomId}`);
      handleUserLeaving(socket, roomId, username, io);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

      // Find which room the user was in and handle leaving
      for (const [roomId, roomData] of rooms.entries()) {
        const userIndex = roomData.users.findIndex(user => user.id === socket.id);

        if (userIndex !== -1) {
          const username = roomData.users[userIndex].username;
          
          // For temporary disconnections (like tab switching), don't immediately remove user
          if (reason === 'transport close' || reason === 'ping timeout') {
            console.log(`Temporary disconnect for ${username}, keeping in room for potential reconnection`);
            // Mark user as temporarily disconnected but don't remove immediately
            roomData.users[userIndex].disconnectedAt = new Date();
            
            // Set a timeout to remove user if they don't reconnect within 30 seconds
            setTimeout(() => {
              const currentUser = roomData.users.find(user => user.id === socket.id);
              if (currentUser && currentUser.disconnectedAt) {
                console.log(`User ${username} did not reconnect, removing from room`);
                handleUserLeaving(socket, roomId, username, io);
              }
            }, 30000); // 30 second grace period
          } else {
            // Immediate disconnect for other reasons
            handleUserLeaving(socket, roomId, username, io);
          }
          break;
        }
      }
    });
  });

  // Helper function to handle user leaving
  function handleUserLeaving(socket, roomId, username, io) {
    if (rooms.has(roomId)) {
      const roomData = rooms.get(roomId);
      const userIndex = roomData.users.findIndex(user => user.id === socket.id);

      if (userIndex !== -1) {
        // Remove user from the room
        roomData.users.splice(userIndex, 1);
        roomData.activeUsers = Math.max(0, roomData.activeUsers - 1);

        // Leave the socket room
        socket.leave(roomId);

        // Create leave message
        const leaveMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} has left the room`,
          timestamp: new Date().toISOString(),
          roomId
        };

        // Store the message
        roomData.messages.push(leaveMessage);

        // Notify other users
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          username,
          users: roomData.users
        });

        // Send system message
        io.to(roomId).emit('chat-message', leaveMessage);

        console.log(`User ${username} left room ${roomId}, ${roomData.users.length} users remaining`);

        // Clean up empty rooms after a delay to allow for reconnections
        if (roomData.users.length === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).users.length === 0) {
              rooms.delete(roomId);
              console.log(`Room ${roomId} has been deleted (no users)`);
            }
          }, 60000); // Wait 1 minute before deleting empty room
        }
      }
    }
  }

  // Optional: Add a cleanup function to run periodically
  const cleanupInterval = setInterval(() => {
    let cleaned = 0;
    for (const [roomId, roomData] of rooms.entries()) {
      // Remove rooms that have been empty for more than 1 hour
      if (roomData.users.length === 0 && 
          (Date.now() - roomData.createdAt.getTime()) > 3600000) {
        rooms.delete(roomId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} empty rooms`);
    }
  }, 300000); // Run every 5 minutes

  // Clean up interval on server shutdown
  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
  });

  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
  });
}

// Optional: Function to get room statistics (for debugging/monitoring)
function getRoomStats() {
  const stats = {
    totalRooms: rooms.size,
    totalUsers: 0,
    rooms: []
  };

  for (const [roomId, roomData] of rooms.entries()) {
    stats.totalUsers += roomData.users.length;
    stats.rooms.push({
      roomId,
      userCount: roomData.users.length,
      messageCount: roomData.messages.length,
      createdAt: roomData.createdAt
    });
  }

  return stats;
}

module.exports = { 
  setupSocketServer,
  getRoomStats // Export for potential monitoring endpoints
};