/**
 * Game routes for the Criminal Bluff API
 */
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const { protect } = require('../middlewares/authMiddleware');
const { validate } = require('../middlewares/validationMiddleware');
const { gameValidation } = require('../validations');

/**
 * @route   POST /api/game/start
 * @desc    Start a new game
 * @access  Private
 */
router.post('/start', protect, gameController.startGame);

/**
 * @route   POST /api/game/answer
 * @desc    Submit an answer
 * @access  Private
 */
router.post('/answer', protect, validate(gameValidation.submitAnswer), gameController.submitAnswer);

/**
 * @route   POST /api/game/finish
 * @desc    Finish current game
 * @access  Private
 */
router.post('/finish', protect, gameController.finishGame);

/**
 * @route   GET /api/game/current
 * @desc    Get current game session
 * @access  Private
 */
router.get('/current', protect, gameController.getCurrentGame);

module.exports = router; 