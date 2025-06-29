require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const roomRoutes = require('./routes/room');
const callController = require('./controllers/callController'); // Import call controller
const { setupSocketServer } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

// Remove trailing slash from CLIENT_URL if it exists
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

// Middleware
app.use(cors({
  origin: clientUrl,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/rooms', roomRoutes);

// Call-related routes
app.get('/api/rooms/:roomId/call-status', callController.checkCallStatus);

// Basic route
app.get('/', (req, res) => {
  res.send('Collaborative Code Editor API is running!');
});

// Create HTTP server and set up Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
    credentials: true
  },
  debug: true
});

// Initialize socket server
setupSocketServer(io);

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.io server is ready for connections`);
  console.log(`Allowing CORS from: ${clientUrl}`);
});