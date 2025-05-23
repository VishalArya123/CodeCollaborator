const { v4: uuidv4 } = require('uuid');

// In-memory storage for rooms (in production, use a database)
const rooms = new Map();

/**
 * Create a new room
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createRoom = (req, res) => {
  try {
    const roomId = uuidv4();
    
    // Initialize room with default code templates
    rooms.set(roomId, {
      createdAt: new Date(),
      code: {
        html: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Collaborative Editor</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>Start coding together!</p>\n</body>\n</html>',
        css: 'body {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  background-color: #f5f5f5;\n}\n\nh1 {\n  color: #333;\n}',
        js: 'console.log("Collaborative editor is running!");\n\ndocument.addEventListener("DOMContentLoaded", () => {\n  // Your code here\n});'
      }
    });
    
    res.status(201).json({
      success: true,
      roomId,
      message: 'Room created successfully'
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room'
    });
  }
};

/**
 * Check if a room exists
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkRoom = (req, res) => {
  const { roomId } = req.params;
  
  if (rooms.has(roomId)) {
    res.status(200).json({
      success: true,
      exists: true,
      message: 'Room exists'
    });
  } else {
    res.status(404).json({
      success: false,
      exists: false,
      message: 'Room not found'
    });
  }
};