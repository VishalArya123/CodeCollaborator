const rooms = new Map();
const mediasoup = require('mediasoup');
let worker;

async function initializeMediasoup() {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 40000,
      rtcMaxPort: 49999,
    });

    worker.on('died', () => {
      console.error('mediasoup worker died, exiting in 2 seconds...');
      setTimeout(() => process.exit(1), 2000);
    });

    console.log('mediasoup worker initialized successfully');
    return worker;
  } catch (error) {
    console.error('Error initializing mediasoup worker:', error);
    throw error;
  }
}

function setupSocketServer(io) {
  io.engine.opts.maxHttpBufferSize = 100e6;
  const roomRouters = new Map();

  initializeMediasoup().catch(error => {
    console.error('Failed to initialize mediasoup:', error);
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // FIXED: Add missing mediasoup handlers
    socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
      try {
        if (!roomRouters.has(roomId)) {
          if (!worker) {
            throw new Error('Mediasoup worker not initialized');
          }

          const router = await worker.createRouter({
            mediaCodecs: [
              {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                parameters: {
                  'sprop-stereo': 1
                }
              },
              {
                kind: 'audio',
                mimeType: 'audio/PCMU',
                clockRate: 8000,
              },
              {
                kind: 'audio',
                mimeType: 'audio/PCMA', 
                clockRate: 8000,
              }
            ],
          });
          
          router.transports = new Map();
          router.producers = new Map();
          router.consumers = new Map();
          roomRouters.set(roomId, router);
          console.log(`Created enhanced mediasoup router for room: ${roomId}`);
        }
        
        callback({ rtpCapabilities: roomRouters.get(roomId).rtpCapabilities });
      } catch (error) {
        console.error('Error in getRouterRtpCapabilities:', error);
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
          listenIps: [
            { 
              ip: '0.0.0.0', 
              announcedIp: process.env.SERVER_IP || '127.0.0.1' 
            }
          ],
          enableUdp: true,
          enableTcp: true,
          preferUdp: true,
          initialAvailableOutgoingBitrate: 1000000,
          maxIncomingBitrate: 1500000,
        });

        router.transports.set(transport.id, transport);

        transport.on('dtlsstatechange', (dtlsState) => {
          console.log(`Transport ${transport.id} dtlsState changed to ${dtlsState}`);
          if (dtlsState === 'closed') {
            transport.close();
            router.transports.delete(transport.id);
          }
        });

        transport.on('close', () => {
          console.log(`Transport ${transport.id} closed`);
          router.transports.delete(transport.id);
        });

        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      } catch (error) {
        console.error('Error in createWebRtcTransport:', error);
        callback({ error: error.message });
      }
    });

    socket.on('connectTransport', async ({ roomId, transportId, dtlsParameters }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }
        
        const transport = router.transports.get(transportId);
        if (!transport) {
          throw new Error('Transport not found');
        }
        
        await transport.connect({ dtlsParameters });
        console.log(`Transport ${transportId} connected successfully`);
        callback({ success: true });
      } catch (error) {
        console.error('Error in connectTransport:', error);
        callback({ error: error.message });
      }
    });

    socket.on('produce', async ({ roomId, transportId, kind, rtpParameters }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }
        
        const transport = router.transports.get(transportId);
        if (!transport) {
          throw new Error('Transport not found');
        }
        
        const producer = await transport.produce({
          kind,
          rtpParameters,
        });
        
        producer.appData = { 
          userId: socket.id,
          roomId: roomId,
          transportId: transportId
        };
        
        router.producers.set(producer.id, producer);
        
        producer.on('transportclose', () => {
          console.log(`Producer ${producer.id} transport closed`);
          router.producers.delete(producer.id);
        });

        producer.on('close', () => {
          console.log(`Producer ${producer.id} closed`);
          router.producers.delete(producer.id);
        });
        
        callback({ id: producer.id });
        
        socket.to(roomId).emit('new-producer', { 
          userId: socket.id,
          producerId: producer.id,
          kind: producer.kind
        });
        
        console.log(`Producer created: ${producer.id} for user ${socket.id}`);
      } catch (error) {
        console.error('Error in produce:', error);
        callback({ error: error.message });
      }
    });

    // FIXED: Add missing getProducers handler
    socket.on('getProducers', async ({ userId, roomId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }
        
        const producers = [];
        for (const producer of router.producers.values()) {
          if (producer.appData.userId === userId && producer.kind === 'audio') {
            producers.push({
              id: producer.id,
              kind: producer.kind,
            });
          }
        }
        
        callback({ producers });
      } catch (error) {
        console.error('Error in getProducers:', error);
        callback({ error: error.message });
      }
    });

    // FIXED: Add missing resumeConsumer handler
    socket.on('resumeConsumer', async ({ roomId, consumerId }, callback) => {
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }
        
        const consumer = router.consumers.get(consumerId);
        if (!consumer) {
          throw new Error('Consumer not found');
        }
        
        await consumer.resume();
        console.log(`Consumer ${consumerId} resumed`);
        callback({ success: true });
      } catch (error) {
        console.error('Error in resumeConsumer:', error);
        callback({ error: error.message });
      }
    });

    // Existing handlers (join-room, send-message, etc.) remain the same
    socket.on('join-room', ({ roomId, username }) => {
      console.log(`User ${username} (${socket.id}) joining room: ${roomId}`);
      
      if (!roomId || !username) {
        socket.emit('join-error', { message: 'Room ID and username are required' });
        return;
      }

      if (username.length > 50 || roomId.length > 100) {
        socket.emit('join-error', { message: 'Username or room ID too long' });
        return;
      }

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
            html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Collaborative Project</title>\n</head>\n<body>\n    <h1>Welcome to Collaborative Coding!</h1>\n    <p>Start building something amazing together.</p>\n</body>\n</html>',
            css: 'body {\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n    line-height: 1.6;\n    color: #333;\n    max-width: 800px;\n    margin: 0 auto;\n    padding: 20px;\n    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n    min-height: 100vh;\n}\n\nh1 {\n    color: #fff;\n    text-align: center;\n    margin-bottom: 30px;\n    font-size: 2.5rem;\n}\n\np {\n    background: rgba(255, 255, 255, 0.9);\n    padding: 20px;\n    border-radius: 10px;\n    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);\n}',
            js: 'console.log("🚀 Collaborative coding session started!");\n\n// Welcome message with animation\ndocument.addEventListener("DOMContentLoaded", function() {\n    const title = document.querySelector("h1");\n    const paragraph = document.querySelector("p");\n    \n    // Add some interactive behavior\n    title.style.cursor = "pointer";\n    title.addEventListener("click", function() {\n        this.style.transform = this.style.transform === "scale(1.1)" ? "scale(1)" : "scale(1.1)";\n        this.style.transition = "transform 0.3s ease";\n    });\n    \n    // Log team collaboration message\n    console.log("👥 Ready for team collaboration!");\n    console.log("💡 Tip: Use the console to debug your code in real-time!");\n});'
          },
          activeUsers: 0,
          callParticipants: [],
          createdAt: new Date(),
          lastActivity: new Date(),
        });
      }

      const roomData = rooms.get(roomId);
      roomData.lastActivity = new Date();

      const existingUserIndex = roomData.users.findIndex(user => user.id === socket.id);
      
      if (existingUserIndex === -1) {
        const user = {
          id: socket.id,
          username: username.trim(),
          joinedAt: new Date(),
          isInCall: false,
          micEnabled: true,
          isSpeaking: false,
          isTyping: false,
          lastActive: new Date(),
          language: 'html',
          cursor: null
        };
        
        roomData.users.push(user);
        roomData.activeUsers += 1;

        const joinMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} joined the collaboration`,
          timestamp: new Date().toISOString(),
          roomId,
          type: 'join'
        };

        roomData.messages.push(joinMessage);
        
        socket.to(roomId).emit('user-joined', {
          user,
          users: roomData.users,
        });
        
        io.to(roomId).emit('chat-message', joinMessage);
      } else {
        roomData.users[existingUserIndex].id = socket.id;
        roomData.users[existingUserIndex].reconnectedAt = new Date();
        roomData.users[existingUserIndex].lastActive = new Date();
      }

      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        messages: roomData.messages.slice(-100),
        files: roomData.files.slice(-50),
        code: roomData.code,
        activeUsers: roomData.activeUsers
      });

      if (roomData.callParticipants.length > 0) {
        socket.emit('call-started', {
          roomId,
          participants: roomData.callParticipants,
        });
      }

      console.log(`Room ${roomId} now has ${roomData.users.length} users`);
    });

    // Continue with other existing handlers...
    socket.on('send-message', ({ roomId, message, username, timestamp, replyTo, type = 'text' }) => {
      console.log(`Message from ${username} in room ${roomId}: ${message}`);
      
      if (!rooms.has(roomId)) {
        console.log(`Room ${roomId} not found, cannot send message`);
        socket.emit('message-error', { message: 'Room not found' });
        return;
      }

      if (!message || message.trim().length === 0) {
        socket.emit('message-error', { message: 'Message cannot be empty' });
        return;
      }

      if (message.length > 1000) {
        socket.emit('message-error', { message: 'Message too long (max 1000 characters)' });
        return;
      }

      const roomData = rooms.get(roomId);
      roomData.lastActivity = new Date();

      const messageData = {
        id: `${Date.now()}-${socket.id}-${Math.random()}`,
        sender: username,
        username: username,
        userId: socket.id,
        message: message.trim(),
        timestamp: timestamp || new Date().toISOString(),
        roomId,
        type,
        replyTo: replyTo || null,
        reactions: {},
        edited: false
      };

      roomData.messages.push(messageData);

      if (roomData.messages.length > 1000) {
        roomData.messages = roomData.messages.slice(-1000);
      }

      const user = roomData.users.find(u => u.id === socket.id);
      if (user) {
        user.lastActive = new Date();
      }

      io.to(roomId).emit('chat-message', messageData);
      console.log(`Message broadcasted to room ${roomId} with ${roomData.users.length} users`);
    });

    // Add all other existing handlers (typing, code-change, cursor-position, start-call, etc.)
    // ... (keeping the same implementation as before)

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      
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
        roomData.lastActivity = new Date();
        
        socket.leave(roomId);

        const leaveMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${username} left the collaboration`,
          timestamp: new Date().toISOString(),
          roomId,
          type: 'leave'
        };
        
        roomData.messages.push(leaveMessage);

        socket.to(roomId).emit('user-left', {
          userId: socket.id,
          username,
          users: roomData.users,
        });
        
        io.to(roomId).emit('chat-message', leaveMessage);

        console.log(`User ${username} left room ${roomId}, ${roomData.users.length} users remaining`);

        if (roomData.users.length === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).users.length === 0) {
              if (roomRouters.has(roomId)) {
                const router = roomRouters.get(roomId);
                router.close();
                roomRouters.delete(roomId);
              }
              
              rooms.delete(roomId);
              console.log(`Room ${roomId} has been deleted (no users)`);
            }
          }, 60000);
        }
      }
    }
  }
}

module.exports = {
  setupSocketServer,
  rooms,
};
