/**
 * User routes for the Criminal Bluff API
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/authMiddleware');

/**
 * @route   POST /api/user/create
 * @desc    Create or update a user profile from Telegram data
 * @access  Public
 */
router.post('/create', userController.createUser);

/**
 * @route   POST /api/user/telegram-auth
 * @desc    Authenticate user via Telegram WebApp
 * @access  Public
 */
router.post('/telegram-auth', userController.telegramAuth);

// Защищенные маршруты
router.use(authMiddleware);

/**
 * @route   GET /api/user/profile
 * @desc    Get the current user profile
 * @access  Private
 */
router.get('/profile', userController.getUserProfile);

/**
 * @route   GET /api/user/achievements
 * @desc    Get user achievements
 * @access  Private
 */
router.get('/achievements', userController.getUserAchievements);

/**
 * @route   GET /api/user/stats
 * @desc    Get user game statistics
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   GET /api/user/webapp-config
 * @desc    Получить конфигурацию для Telegram WebApp
 * @access  Private
 */
router.get('/webapp-config', userController.getWebAppConfig);

/**
 * @route   PUT /api/user/avatar
 * @desc    Update user avatar
 * @access  Private
 */
router.put('/avatar', userController.updateUserAvatar);

/**
 * @route   GET /api/user/:userId
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:userId', userController.getUserById);

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', userController.updateProfile);

/**
 * @route   GET /api/user/:userId/achievements
 * @desc    Get user achievements
 * @access  Private
 */
router.get('/:userId/achievements', userController.getUserAchievements);

module.exports = router; 