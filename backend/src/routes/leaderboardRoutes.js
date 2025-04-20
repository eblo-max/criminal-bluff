/**
 * Leaderboard routes for the Criminal Bluff API
 */
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const authMiddleware = require('../middlewares/authMiddleware');

// Apply auth middleware to all leaderboard routes
router.use(authMiddleware);

/**
 * @route   GET /api/leaderboard/daily
 * @desc    Get the daily leaderboard
 * @access  Private
 */
router.get('/daily', leaderboardController.getDailyLeaderboard);

/**
 * @route   GET /api/leaderboard/weekly
 * @desc    Get the weekly leaderboard
 * @access  Private
 */
router.get('/weekly', leaderboardController.getWeeklyLeaderboard);

/**
 * @route   GET /api/leaderboard/all-time
 * @desc    Get the all-time leaderboard
 * @access  Private
 */
router.get('/all-time', leaderboardController.getAllTimeLeaderboard);

/**
 * @route   GET /api/leaderboard/user-position
 * @desc    Get the user's position across all leaderboards
 * @access  Private
 */
router.get('/user-position', leaderboardController.getUserPosition);

/**
 * @route   GET /api/leaderboard/user-neighbors
 * @desc    Get users adjacent to the current user in the leaderboard
 * @access  Private
 */
router.get('/user-neighbors', leaderboardController.getUserNeighbors);

module.exports = router; 