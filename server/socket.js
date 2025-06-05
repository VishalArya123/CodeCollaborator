const rooms = new Map();
const mediasoup = require('mediasoup');
let worker;

async function initializeMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 40000,
    rtcMaxPort: 49999
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds...');
    setTimeout(() => process.exit(1), 2000);
  });

  return worker;
}

function setupSocketServer(io) {
  io.engine.opts.maxHttpBufferSize = 50e6; // 50MB
  const roomRouters = new Map();

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
      try {
        if (!roomRouters.has(roomId)) {
          const router = await worker.createRouter({
            mediaCodecs: [
              {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2
              },
              {
                kind: 'video',
                mimeType: 'video/VP8',
                clockRate: 90000,
                parameters: {
                  'x-google-start-bitrate': 1000
                }
              }
            ]
          });
          roomRouters.set(roomId, router);
        }
        
        callback({
          rtpCapabilities: roomRouters.get(roomId).rtpCapabilities
        });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('createWebRtcTransport', async ({ roomId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        const transport = await router.createWebRtcTransport({
          listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.SERVER_IP }],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1000000
        });

        transport.on('dtlsstatechange', (dtlsState) => {
          if (dtlsState === 'closed') {
            transport.close();
          }
        });

        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
          }
        });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('connectTransport', async ({ roomId, dtlsParameters, transportId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        // Find transport in router's transports
        let transport;
        for (const t of router._transports.values()) {
          if (t.id === transportId) {
            transport = t;
            break;
          }
        }

        if (!transport) {
          throw new Error('Transport not found');
        }

        await transport.connect({ dtlsParameters });
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        let transport;
        for (const t of router._transports.values()) {
          if (t.id === transportId) {
            transport = t;
            break;
          }
        }

        if (!transport) {
          throw new Error('Transport not found');
        }

        const producer = await transport.produce({
          kind,
          rtpParameters
        });

        callback({
          id: producer.id,
          kind: producer.kind
        });

        socket.to(roomId).emit('new-producer', {
          producerId: producer.id,
          userId: socket.id,
          kind: producer.kind
        });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('getProducers', async ({ roomId, userId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        const producers = [];
        for (const transport of router._transports.values()) {
          for (const producer of transport._producers.values()) {
            if (producer.appData && producer.appData.userId === userId) {
              producers.push({
                id: producer.id,
                kind: producer.kind
              });
            }
          }
        }

        callback({ producers });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('resumeConsumer', async ({ roomId, consumerId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        let consumer;
        for (const transport of router._transports.values()) {
          if (transport._consumers.has(consumerId)) {
            consumer = transport._consumers.get(consumerId);
            break;
          }
        }

        if (!consumer) {
          throw new Error('Consumer not found');
        }

        await consumer.resume();
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });

    socket.on('join-room', ({ roomId, username }) => {
      console.log(`User ${username} (${socket.id}) joining room: ${roomId}`);
      
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });

      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          users: [],
          messages: [],
          files: [],
          code: {
            html: '',
            css: '',
            js: ''
          },
          activeUsers: 0,
          callParticipants: [],
          createdAt: new Date()
        });
      }

      const roomData = rooms.get(roomId);
      const existingUserIndex = roomData.users.findIndex(user => user.id === socket.id);
      
      if (existingUserIndex === -1) {
        const user = {
          id: socket.id,
          username,
          joinedAt: new Date(),
          isInCall: false,
          micEnabled: true,
          videoEnabled: true,
        };

        roomData.users.push(user);
        roomData.activeUsers += 1;

        const joinMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} has joined the room`,
          timestamp: new Date().toISOString(),
          roomId
        };

        roomData.messages.push(joinMessage);
        socket.to(roomId).emit('user-joined', {
          user,
          users: roomData.users
        });
        io.to(roomId).emit('chat-message', joinMessage);
      } else {
        roomData.users[existingUserIndex].id = socket.id;
        roomData.users[existingUserIndex].reconnectedAt = new Date();
      }

      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        messages: roomData.messages,
        files: roomData.files,
        code: roomData.code
      });

      if (roomData.callParticipants.length > 0) {
        socket.emit('call-started', {
          roomId,
          participants: roomData.callParticipants
        });
      }

      console.log(`Room ${roomId} now has ${roomData.users.length} users`);
    });

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

    socket.on('get-room-files', ({ roomId }) => {
      console.log(`User ${socket.id} requesting files for room: ${roomId}`);
      
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        socket.emit('files-updated', roomData.files);
      } else {
        socket.emit('files-updated', []);
      }
    });

    socket.on('upload-files', ({ roomId, files }) => {
      console.log(`User ${socket.id} uploading ${files.length} files to room: ${roomId}`);
      
      if (!rooms.has(roomId)) {
        console.log(`Room ${roomId} not found, cannot upload files`);
        socket.emit('upload-error', { message: 'Room not found' });
        return;
      }

      try {
        const roomData = rooms.get(roomId);
        
        files.forEach(file => {
          const existingFileIndex = roomData.files.findIndex(f => f.name === file.name);
          if (existingFileIndex !== -1) {
            roomData.files[existingFileIndex] = file;
          } else {
            roomData.files.push(file);
          }
        });

        if (roomData.files.length > 100) {
          roomData.files = roomData.files.slice(-100);
        }

        io.to(roomId).emit('files-updated', roomData.files);

        const fileNames = files.map(f => f.name).join(', ');
        const uploadMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${files[0].uploadedBy} uploaded ${files.length} file(s): ${fileNames}`,
          timestamp: new Date().toISOString(),
          roomId
        };

        roomData.messages.push(uploadMessage);
        io.to(roomId).emit('chat-message', uploadMessage);

        console.log(`Files uploaded to room ${roomId}, total files: ${roomData.files.length}`);
      } catch (error) {
        console.error('Error handling file upload:', error);
        socket.emit('upload-error', { message: 'File upload failed - file may be too large' });
      }
    });

    socket.on('delete-file', ({ roomId, fileId }) => {
      console.log(`User ${socket.id} deleting file ${fileId} from room: ${roomId}`);
      
      if (!rooms.has(roomId)) {
        console.log(`Room ${roomId} not found, cannot delete file`);
        return;
      }

      const roomData = rooms.get(roomId);
      const fileIndex = roomData.files.findIndex(f => f.id === fileId);
      
      if (fileIndex !== -1) {
        const deletedFile = roomData.files[fileIndex];
        roomData.files.splice(fileIndex, 1);

        io.to(roomId).emit('files-updated', roomData.files);

        const deleteMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `File "${deletedFile.name}" was deleted`,
          timestamp: new Date().toISOString(),
          roomId
        };

        roomData.messages.push(deleteMessage);
        io.to(roomId).emit('chat-message', deleteMessage);

        console.log(`File ${deletedFile.name} deleted from room ${roomId}`);
      }
    });

    socket.on('code-change', ({ roomId, language, code }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        roomData.code[language] = code;

        socket.to(roomId).emit('code-update', {
          language,
          code
        });
      }
    });

    socket.on('cursor-position', ({ roomId, position, username }) => {
      socket.to(roomId).emit('cursor-update', {
        userId: socket.id,
        username,
        position
      });
    });

    socket.on('send-message', ({ roomId, message, username, timestamp }) => {
      console.log(`Message from ${username} in room ${roomId}: ${message}`);
      
      if (!rooms.has(roomId)) {
        console.log(`Room ${roomId} not found, cannot send message`);
        return;
      }

      const roomData = rooms.get(roomId);
      
      const messageData = {
        id: `${Date.now()}-${socket.id}`,
        sender: username,
        username: username,
        userId: socket.id,
        message: message.trim(),
        timestamp: timestamp || new Date().toISOString(),
        roomId
      };

      roomData.messages.push(messageData);

      if (roomData.messages.length > 1000) {
        roomData.messages = roomData.messages.slice(-1000);
      }

      console.log(`Broadcasting message to room ${roomId}, room has ${roomData.users.length} users`);
      
      io.to(roomId).emit('chat-message', messageData);
    });

    socket.on('typing', ({ roomId, username, isTyping }) => {
      socket.to(roomId).emit('user-typing', {
        userId: socket.id,
        username,
        isTyping
      });
    });

    socket.on('start-call', ({ roomId }) => {
      if (!rooms.has(roomId)) return;
      
      const roomData = rooms.get(roomId);
      const user = roomData.users.find(u => u.id === socket.id);
      if (!user) return;
    
      if (!roomData.callParticipants) {
        roomData.callParticipants = [];
      }
    
      const alreadyInCall = roomData.callParticipants.some(p => p.id === socket.id);
      if (!alreadyInCall) {
        const participant = {
          id: socket.id,
          username: user.username,
          micEnabled: true,
          videoEnabled: true,
        };
        
        roomData.callParticipants.push(participant);
        user.isInCall = true;
    
        io.to(roomId).emit('call-started', {
          roomId,
          participants: roomData.callParticipants
        });
        
        socket.to(roomId).emit('user-joined-call', {
          userId: socket.id,
          username: user.username,
          micEnabled: true,
          videoEnabled: true
        });
        
        console.log(`User ${user.username} joined call in room ${roomId}`);
      }
    });

    socket.on('leave-call', ({ roomId }) => {
      console.log(`User ${socket.id} leaving call in room: ${roomId}`);
      handleCallLeaving(socket, roomId, io);
    });

    socket.on('toggle-mic', ({ userId, micEnabled, roomId }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        const participant = roomData.callParticipants.find(p => p.id === userId);
        if (participant) {
          participant.micEnabled = micEnabled;
          io.to(roomId).emit('toggle-mic', { userId, micEnabled });
        }
      }
    });
    
    socket.on('toggle-video', ({ userId, videoEnabled, roomId }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        const participant = roomData.callParticipants.find(p => p.id === userId);
        if (participant) {
          participant.videoEnabled = videoEnabled;
          io.to(roomId).emit('toggle-video', { userId, videoEnabled });
        }
      }
    });

    socket.on('leave-room', ({ roomId, username }) => {
      console.log(`User ${username} explicitly leaving room: ${roomId}`);
      handleUserLeaving(socket, roomId, username, io);
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

      for (const [roomId, roomData] of rooms.entries()) {
        const userIndex = roomData.users.findIndex(user => user.id === socket.id);

        if (userIndex !== -1) {
          const username = roomData.users[userIndex].username;
          
          if (reason === 'transport close' || reason === 'ping timeout') {
            console.log(`Temporary disconnect for ${username}, keeping in room for potential reconnection`);
            roomData.users[userIndex].disconnectedAt = new Date();
            
            setTimeout(() => {
              const currentUser = roomData.users.find(user => user.id === socket.id);
              if (currentUser && currentUser.disconnectedAt) {
                console.log(`User ${username} did not reconnect, removing from room`);
                handleUserLeaving(socket, roomId, username, io);
              }
            }, 30000);
          } else {
            handleUserLeaving(socket, roomId, username, io);
          }
          break;
        }
      }
    });
  });

  function handleUserLeaving(socket, roomId, username, io) {
    if (rooms.has(roomId)) {
      const roomData = rooms.get(roomId);
      const userIndex = roomData.users.findIndex(user => user.id === socket.id);

      if (userIndex !== -1) {
        if (roomData.callParticipants) {
          const participantIndex = roomData.callParticipants.findIndex(p => p.id === socket.id);
          if (participantIndex !== -1) {
            roomData.callParticipants.splice(participantIndex, 1);
            roomData.users[userIndex].isInCall = false;
            io.to(roomId).emit('user-left-call', { userId: socket.id });
          }
        }

        roomData.users.splice(userIndex, 1);
        roomData.activeUsers = Math.max(0, roomData.activeUsers - 1);

        socket.leave(roomId);

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

        console.log(`User ${username} left room ${roomId}, ${roomData.users.length} users remaining`);

        if (roomData.users.length === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).users.length === 0) {
              rooms.delete(roomId);
              roomRouters.delete(roomId);
              console.log(`Room ${roomId} has been deleted (no users)`);
            }
          }, 60000);
        }
      }
    }
  }

  function handleCallLeaving(socket, roomId, io) {
    if (rooms.has(roomId)) {
      const roomData = rooms.get(roomId);
      const participantIndex = roomData.callParticipants.findIndex(p => p.id === socket.id);
      const user = roomData.users.find(u => u.id === socket.id);

      if (participantIndex !== -1 && user) {
        roomData.callParticipants.splice(participantIndex, 1);
        user.isInCall = false;

        io.to(roomId).emit('user-left-call', { userId: socket.id });
        console.log(`User ${socket.id} left call in room ${roomId}, ${roomData.callParticipants.length} participants remaining`);
      }
    }
  }

  const cleanupInterval = setInterval(() => {
    let cleaned = 0;
    for (const [roomId, roomData] of rooms.entries()) {
      if (roomData.users.length === 0 && 
          (Date.now() - roomData.createdAt.getTime()) > 3600000) {
        rooms.delete(roomId);
        roomRouters.delete(roomId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} empty rooms`);
    }
  }, 300000);

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
  });

  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
  });
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
      fileCount: roomData.files.length,
      callParticipantCount: roomData.callParticipants ? roomData.callParticipants.length : 0,
      createdAt: roomData.createdAt
    });
  }

  return stats;
}

module.exports = { 
  setupSocketServer,
  getRoomStats,
  initializeMediasoup
};