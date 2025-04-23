/**
 * Leaderboard routes for the Criminal Bluff API
 */
const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Apply auth middleware to all leaderboard routes
router.use(authMiddleware);

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
 * @route   GET /api/leaderboard/global
 * @desc    Get the global leaderboard (same as all-time)
 * @access  Private
 */
router.get('/global', leaderboardController.getAllTimeLeaderboard);

/**
 * @route   GET /api/leaderboard/user/:userId
 * @desc    Get user's position in leaderboards
 * @access  Private
 */
router.get('/user/:userId', leaderboardController.getUserPosition);

/**
 * @route   GET /api/leaderboard/neighbors/:userId
 * @desc    Get user's neighbors in the leaderboard
 * @access  Private
 */
router.get('/neighbors/:userId', leaderboardController.getUserNeighbors);

module.exports = router; 