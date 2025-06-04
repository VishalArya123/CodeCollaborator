const rooms = new Map(); // Assuming rooms are shared from socket.js

/**
 * Check if a call is active in a room
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.checkCallStatus = (req, res) => {
  const { roomId } = req.params;

  if (rooms.has(roomId)) {
    const roomData = rooms.get(roomId);
    const callParticipants = roomData.callParticipants || [];
    res.status(200).json({
      success: true,
      isActive: callParticipants.length > 0,
      participantCount: callParticipants.length,
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Room not found',
    });
  }
};