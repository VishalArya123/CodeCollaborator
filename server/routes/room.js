const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Create a new room
router.post('/create', roomController.createRoom);

// Check if room exists
router.get('/:roomId', roomController.checkRoom);

module.exports = router;