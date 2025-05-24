// Store active rooms and users
const rooms = new Map();

function setupSocketServer(io) {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Track user's current room
    let currentRoom = null;

    socket.on('join-room', ({ roomId, username }) => {
      // Prevent duplicate joins
      if (currentRoom === roomId) {
        console.log(`User ${username} already in room ${roomId}`);
        return;
      }

      // Leave previous room if exists
      if (currentRoom) {
        handleUserLeaving(socket, currentRoom, username, false);
      }

      console.log(`User ${username} (${socket.id}) joining room: ${roomId}`);
      socket.join(roomId);
      currentRoom = roomId;

      // Initialize room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: [],
          messages: [],
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
      const existingUserIndex = roomData.users.findIndex(user => user.id === socket.id);

      if (existingUserIndex === -1) {
        // Add new user
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

        roomData.messages.push(joinMessage);
        
        // Notify other users
        socket.to(roomId).emit('user-joined', {
          user,
          users: roomData.users
        });

        // Send system message
        io.to(roomId).emit('chat-message', joinMessage);
      }

      // Send room data to user
      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        messages: roomData.messages,
        code: roomData.code
      });
    });

    // Handle message history request
    socket.on('get-room-messages', ({ roomId }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        socket.emit('room-messages', {
          roomId,
          messages: roomData.messages
        });
      }
    });

    // Handle chat messages
    socket.on('send-message', ({ roomId, message, username }) => {
      if (!rooms.has(roomId)) return;

      const roomData = rooms.get(roomId);
      const messageData = {
        id: `${Date.now()}-${socket.id}`,
        sender: username,
        username,
        userId: socket.id,
        message: message.trim(),
        timestamp: new Date().toISOString(),
        roomId
      };

      roomData.messages.push(messageData);
      
      // Limit message history
      if (roomData.messages.length > 1000) {
        roomData.messages = roomData.messages.slice(-1000);
      }

      io.to(roomId).emit('chat-message', messageData);
    });

    // Handle typing indicators
    socket.on('typing', ({ roomId, username, isTyping }) => {
      socket.to(roomId).emit('user-typing', {
        userId: socket.id,
        username,
        isTyping
      });
    });

    // Handle explicit room leaving
    socket.on('leave-room', ({ roomId, username }) => {
      if (currentRoom === roomId) {
        handleUserLeaving(socket, roomId, username, true);
        currentRoom = null;
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      if (currentRoom) {
        const roomData = rooms.get(currentRoom);
        const user = roomData?.users.find(u => u.id === socket.id);
        if (user) {
          handleUserLeaving(socket, currentRoom, user.username, false);
        }
      }
    });
  });

  // Helper function to handle user leaving
  function handleUserLeaving(socket, roomId, username, isIntentional) {
    if (!rooms.has(roomId)) return;

    const roomData = rooms.get(roomId);
    const userIndex = roomData.users.findIndex(user => user.id === socket.id);

    if (userIndex !== -1) {
      roomData.users.splice(userIndex, 1);
      roomData.activeUsers = Math.max(0, roomData.activeUsers - 1);

      socket.leave(roomId);

      // Only send leave message for intentional leaves
      if (isIntentional) {
        const leaveMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} has left the room`,
          timestamp: new Date().toISOString(),
          roomId
        };

        roomData.messages.push(leaveMessage);
        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          username,
          users: roomData.users
        });
        io.to(roomId).emit('chat-message', leaveMessage);
      }

      // Clean up empty rooms after delay
      if (roomData.users.length === 0) {
        setTimeout(() => {
          if (rooms.has(roomId) && rooms.get(roomId).users.length === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} cleaned up`);
          }
        }, 300000); // 5 minutes
      }
    }
  }

  // Periodic cleanup
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [roomId, roomData] of rooms.entries()) {
      if (roomData.users.length === 0 && 
          (now - roomData.createdAt.getTime()) > 3600000) {
        rooms.delete(roomId);
      }
    }
  }, 1800000); // 30 minutes

  process.on('SIGTERM', () => clearInterval(cleanupInterval));
  process.on('SIGINT', () => clearInterval(cleanupInterval));
}

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
  getRoomStats
};