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
          code: {
            html: '',
            css: '',
            js: ''
          },
          activeUsers: 0
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

        // Notify other users about the new user
        socket.to(roomId).emit('user-joined', {
          user,
          users: roomData.users
        });

        // Send system message
        io.to(roomId).emit('chat-message', {
          id: Date.now(),
          sender: 'system',
          message: `${username} has joined the room`,
          timestamp: new Date()
        });
      }

      // Emit welcome message to the user (always send current state)
      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        code: roomData.code
      });
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
    socket.on('send-message', ({ roomId, message, username }) => {
      const messageData = {
        id: Date.now(),
        sender: username,
        userId: socket.id,
        message,
        timestamp: new Date()
      };

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
      handleUserLeaving(socket, roomId, username, io);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);

      // Find which room the user was in and handle leaving
      for (const [roomId, roomData] of rooms.entries()) {
        const userIndex = roomData.users.findIndex(user => user.id === socket.id);

        if (userIndex !== -1) {
          const username = roomData.users[userIndex].username;
          handleUserLeaving(socket, roomId, username, io);
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

        // Notify other users
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          users: roomData.users
        });

        // Send system message
        io.to(roomId).emit('chat-message', {
          id: Date.now(),
          sender: 'system',
          message: `${username} has left the room`,
          timestamp: new Date()
        });

        // Clean up empty rooms
        if (roomData.users.length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} has been deleted (no users)`);
        }
      }
    }
  }
}

module.exports = { setupSocketServer };