const rooms = new Map();

function setupSocketServer(io) {
  io.engine.opts.maxHttpBufferSize = 100e6;

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // FIXED: WebRTC signaling for peer-to-peer audio
    socket.on('offer', ({ to, offer, roomId }) => {
      console.log(`Forwarding offer from ${socket.id} to ${to}`);
      socket.to(to).emit('offer', {
        from: socket.id,
        offer,
        roomId
      });
    });

    socket.on('answer', ({ to, answer, roomId }) => {
      console.log(`Forwarding answer from ${socket.id} to ${to}`);
      socket.to(to).emit('answer', {
        from: socket.id,
        answer,
        roomId
      });
    });

    socket.on('ice-candidate', ({ to, candidate, roomId }) => {
      console.log(`Forwarding ICE candidate from ${socket.id} to ${to}`);
      socket.to(to).emit('ice-candidate', {
        from: socket.id,
        candidate,
        roomId
      });
    });

    // Fallback handlers (keeping existing mediasoup handlers for compatibility)
    socket.on('getRouterRtpCapabilities', async ({ roomId }, callback) => {
      console.log('Using fallback WebRTC mode');
      const fallbackCapabilities = {
        codecs: [
          {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {},
            rtcpFeedback: []
          }
        ],
        headerExtensions: []
      };
      callback({ rtpCapabilities: fallbackCapabilities });
    });

    socket.on('createWebRtcTransport', async ({ roomId }, callback) => {
      const fallbackTransport = {
        id: `fallback-${Date.now()}-${Math.random()}`,
        iceParameters: { usernameFragment: 'fallback', password: 'fallback-password' },
        iceCandidates: [],
        dtlsParameters: {
          fingerprints: [{ algorithm: 'sha-256', value: 'fallback-fingerprint' }],
          role: 'auto'
        }
      };
      callback(fallbackTransport);
    });

    socket.on('connectTransport', async (data, callback) => {
      callback({ success: true });
    });

    socket.on('produce', async (data, callback) => {
      const mockProducerId = `fallback-producer-${Date.now()}`;
      callback({ id: mockProducerId });
    });

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

        const callMessage = {
          id: `${Date.now()}-${socket.id}`,
          sender: 'system',
          message: `${user.username} joined the audio call`,
          timestamp: new Date().toISOString(),
          roomId,
          type: 'call-join'
        };
        
        roomData.messages.push(callMessage);
        io.to(roomId).emit('chat-message', callMessage);
      }
    });

    // FIXED: Enhanced toggle-mic handler with better tracking
    socket.on('toggle-mic', ({ userId, micEnabled, roomId }) => {
      console.log(`User ${userId} ${micEnabled ? 'unmuted' : 'muted'} in room ${roomId}`);
      
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        
        // Update user state
        const user = roomData.users.find(u => u.id === userId);
        if (user) {
          user.micEnabled = micEnabled;
        }
        
        // Update call participant state
        const participant = roomData.callParticipants?.find(p => p.id === userId);
        if (participant) {
          participant.micEnabled = micEnabled;
        }
        
        // Broadcast to all users in room
        io.to(roomId).emit('toggle-mic', { userId, micEnabled });
      }
    });

    socket.on('speaking-status', ({ userId, isSpeaking, roomId }) => {
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        const participant = roomData.callParticipants?.find(p => p.id === userId);
        if (participant) {
          participant.isSpeaking = isSpeaking;
        }
        
        socket.to(roomId).emit('speaking-status', { userId, isSpeaking });
      }
    });

    // Other existing handlers...
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
