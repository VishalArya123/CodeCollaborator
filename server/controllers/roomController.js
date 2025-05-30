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
      },
      files: [], // Initialize empty files array
      users: [], // Initialize empty users array
      messages: [], // Initialize empty messages array
      activeUsers: 0
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
    const roomData = rooms.get(roomId);
    res.status(200).json({
      success: true,
      exists: true,
      message: 'Room exists',
      roomInfo: {
        createdAt: roomData.createdAt,
        userCount: roomData.users.length,
        fileCount: roomData.files.length,
        messageCount: roomData.messages.length
      }
    });
  } else {
    res.status(404).json({
      success: false,
      exists: false,
      message: 'Room not found'
    });
  }
};

/**
 * Get room statistics (optional endpoint for monitoring)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getRoomStats = (req, res) => {
  try {
    const { roomId } = req.params;

    if (roomId) {
      // Get specific room stats
      if (rooms.has(roomId)) {
        const roomData = rooms.get(roomId);
        res.status(200).json({
          success: true,
          roomId,
          stats: {
            userCount: roomData.users.length,
            fileCount: roomData.files.length,
            messageCount: roomData.messages.length,
            createdAt: roomData.createdAt,
            activeUsers: roomData.activeUsers
          }
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }
    } else {
      // Get all rooms stats
      const stats = {
        totalRooms: rooms.size,
        totalUsers: 0,
        totalFiles: 0,
        totalMessages: 0,
        rooms: []
      };

      for (const [roomId, roomData] of rooms.entries()) {
        stats.totalUsers += roomData.users.length;
        stats.totalFiles += roomData.files.length;
        stats.totalMessages += roomData.messages.length;
        stats.rooms.push({
          roomId,
          userCount: roomData.users.length,
          fileCount: roomData.files.length,
          messageCount: roomData.messages.length,
          createdAt: roomData.createdAt,
          activeUsers: roomData.activeUsers
        });
      }

      res.status(200).json({
        success: true,
        stats
      });
    }
  } catch (error) {
    console.error('Error getting room stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room statistics'
    });
  }
};

/**
 * Delete a room (optional endpoint for cleanup)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteRoom = (req, res) => {
  try {
    const { roomId } = req.params;

    if (rooms.has(roomId)) {
      const roomData = rooms.get(roomId);
      
      // Only allow deletion if room is empty
      if (roomData.users.length === 0) {
        rooms.delete(roomId);
        res.status(200).json({
          success: true,
          message: 'Room deleted successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Cannot delete room with active users'
        });
      }
    } else {
      res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete room'
    });
  }
};