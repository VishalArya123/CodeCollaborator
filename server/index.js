require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const roomRoutes = require('./routes/room');
const { setupSocketServer } = require('./socket');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/rooms', roomRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Collaborative Code Editor API is running!');
});

// Create HTTP server and set up Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  debug: true  // Add this for debugging
});

// Initialize socket server
setupSocketServer(io);

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.io server is ready for connections`);
});