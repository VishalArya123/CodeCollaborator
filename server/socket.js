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

  // Initialize mediasoup worker immediately
  initializeMediasoup().then(() => {
    console.log('Mediasoup worker ready for connections');
  }).catch(error => {
    console.error('Failed to initialize mediasoup:', error);
    // Continue without mediasoup for now
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // FIXED: Enhanced mediasoup handlers with better error handling
    socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
      console.log(`Getting router RTP capabilities for room: ${roomId}`);
      
      try {
        if (!worker) {
          console.log('Mediasoup worker not available, initializing...');
          await initializeMediasoup();
        }

        if (!roomRouters.has(roomId)) {
          console.log(`Creating new router for room: ${roomId}`);
          
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
          console.log(`Router created successfully for room: ${roomId}`);
        }
        
        const router = roomRouters.get(roomId);
        console.log('Sending RTP capabilities to client');
        callback({ rtpCapabilities: router.rtpCapabilities });
        
      } catch (error) {
        console.error('Error in getRouterRtpCapabilities:', error);
        callback({ error: error.message });
      }
    });

    socket.on('createWebRtcTransport', async ({ roomId }, callback) => {
      console.log(`Creating WebRTC transport for room: ${roomId}`);
      
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          throw new Error('Router not found for room');
        }

        const transport = await router.createWebRtcTransport({
          listenIps: [
            { 
              ip: '0.0.0.0', 
              announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1' 
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

        console.log(`Transport created successfully: ${transport.id}`);
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
      console.log(`Connecting transport ${transportId} for room: ${roomId}`);
      
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
      console.log(`Producing ${kind} media for room: ${roomId}`);
      
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
        
        console.log(`Producer created: ${producer.id} for user ${socket.id}`);
        callback({ id: producer.id });
        
        socket.to(roomId).emit('new-producer', { 
          userId: socket.id,
          producerId: producer.id,
          kind: producer.kind
        });
        
      } catch (error) {
        console.error('Error in produce:', error);
        callback({ error: error.message });
      }
    });

    socket.on('getProducers', async ({ userId, roomId }, callback) => {
      console.log(`Getting producers for user ${userId} in room: ${roomId}`);
      
      try {
        const router = roomRouters.get(roomId);
        if (!router) {
          console.log(`Router not found for room: ${roomId}`);
          callback({ producers: [] });
          return;
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
        
        console.log(`Found ${producers.length} producers for user ${userId}`);
        callback({ producers });
      } catch (error) {
        console.error('Error in getProducers:', error);
        callback({ error: error.message });
      }
    });

    socket.on('resumeConsumer', async ({ roomId, consumerId }, callback) => {
      console.log(`Resuming consumer ${consumerId} for room: ${roomId}`);
      
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

    // Regular socket handlers
    socket.on('join-room', ({ roomId, username }) => {
      console.log(`User ${username} (${socket.id}) joining room: ${roomId}`);
      
      if (!roomId || !username) {
        socket.emit('join-error', { message: 'Room ID and username are required' });
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
            js: 'console.log("🚀 Collaborative coding session started!");\n\ndocument.addEventListener("DOMContentLoaded", function() {\n    const title = document.querySelector("h1");\n    \n    title.style.cursor = "pointer";\n    title.addEventListener("click", function() {\n        this.style.transform = this.style.transform === "scale(1.1)" ? "scale(1)" : "scale(1.1)";\n        this.style.transition = "transform 0.3s ease";\n    });\n    \n    console.log("👥 Ready for team collaboration!");\n    console.log("💡 Tip: Use the console to debug your code!");\n});'
          },
          callParticipants: [],
          createdAt: new Date(),
          lastActivity: new Date(),
        });
      }

      const roomData = rooms.get(roomId);
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
        };
        
        roomData.users.push(user);

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
      }

      socket.emit('room-joined', {
        roomId,
        users: roomData.users,
        messages: roomData.messages.slice(-100),
        files: roomData.files,
        code: roomData.code,
      });

      console.log(`Room ${roomId} now has ${roomData.users.length} users`);
    });

    socket.on('start-call', ({ roomId }) => {
      console.log(`User ${socket.id} starting call in room: ${roomId}`);
      
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
          isSpeaking: false,
          joinedAt: new Date()
        };
        
        roomData.callParticipants.push(participant);
        user.isInCall = true;

        console.log(`User ${user.username} joined call. Participants:`, roomData.callParticipants.length);

        io.to(roomId).emit('call-started', {
          roomId,
          participants: roomData.callParticipants,
        });

        socket.to(roomId).emit('user-joined-call', {
          userId: socket.id,
          username: user.username,
          micEnabled: true,
        });
      }
    });

    // Add other handlers (send-message, typing, etc.)
    socket.on('send-message', ({ roomId, message, username, timestamp, replyTo, type = 'text' }) => {
      if (!rooms.has(roomId) || !message?.trim()) return;

      const roomData = rooms.get(roomId);
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
      };

      roomData.messages.push(messageData);
      if (roomData.messages.length > 1000) {
        roomData.messages = roomData.messages.slice(-1000);
      }

      io.to(roomId).emit('chat-message', messageData);
    });

    socket.on('typing', ({ roomId, username, isTyping }) => {
      if (!rooms.has(roomId)) return;
      socket.to(roomId).emit('user-typing', {
        userId: socket.id,
        username,
        isTyping,
      });
    });

    socket.on('code-change', ({ roomId, language, code }) => {
      if (!rooms.has(roomId)) return;
      const roomData = rooms.get(roomId);
      roomData.code[language] = code;
      socket.to(roomId).emit('code-update', {
        language,
        code,
        userId: socket.id
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
      
      for (const [roomId, roomData] of rooms.entries()) {
        const userIndex = roomData.users.findIndex(user => user.id === socket.id);
        
        if (userIndex !== -1) {
          const username = roomData.users[userIndex].username;
          
          // Remove from call participants
          if (roomData.callParticipants) {
            const participantIndex = roomData.callParticipants.findIndex(p => p.id === socket.id);
            if (participantIndex !== -1) {
              roomData.callParticipants.splice(participantIndex, 1);
              io.to(roomId).emit('user-left-call', { userId: socket.id });
            }
          }

          roomData.users.splice(userIndex, 1);
          
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
          break;
        }
      }
    });
  });
}

module.exports = {
  setupSocketServer,
  rooms,
};
