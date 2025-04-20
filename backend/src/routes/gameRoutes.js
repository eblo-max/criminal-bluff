/**
 * Game routes for the Criminal Bluff API
 */
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middlewares/authMiddleware');

// Apply auth middleware to all game routes
router.use(authMiddleware);

/**
 * @route   GET /api/game/start
 * @desc    Start a new game with 5 random stories
 * @access  Private
 */
router.get('/start', gameController.startGame);

/**
 * @route   POST /api/game/answer
 * @desc    Submit an answer for the current story
 * @access  Private
 */
router.post('/answer', gameController.submitAnswer);

/**
 * @route   POST /api/game/finish
 * @desc    Finish the current game session
 * @access  Private
 */
router.post('/finish', gameController.finishGame);

/**
 * @route   GET /api/game/current
 * @desc    Get the current game session
 * @access  Private
 */
router.get('/current', gameController.getCurrentGame);

module.exports = router; 