/**
 * Маршруты для административной панели
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const leaderboardController = require('../controllers/leaderboardController');
const notificationController = require('../controllers/notificationController');

// Apply authentication and admin authorization to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Получить данные для дашборда админа
 * @access  Admin
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @route   GET /api/admin/stories
 * @desc    Получить список историй
 * @access  Admin
 */
router.get('/stories', adminController.getStories);

/**
 * @route   POST /api/admin/stories
 * @desc    Создать новую историю
 * @access  Admin
 */
router.post('/stories', adminController.createStory);

/**
 * @route   GET /api/admin/stories/:id
 * @desc    Получить информацию об истории
 * @access  Admin
 */
router.get('/stories/:id', adminController.getStoryById);

/**
 * @route   PUT /api/admin/stories/:id
 * @desc    Обновить историю
 * @access  Admin
 */
router.put('/stories/:id', adminController.updateStory);

/**
 * @route   DELETE /api/admin/stories/:id
 * @desc    Удалить историю
 * @access  Admin
 */
router.delete('/stories/:id', adminController.deleteStory);

/**
 * @route   GET /api/admin/users
 * @desc    Получить список пользователей
 * @access  Admin
 */
router.get('/users', adminController.getUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Получить информацию о пользователе
 * @access  Admin
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Обновить пользователя
 * @access  Admin
 */
router.put('/users/:id', adminController.updateUser);

/**
 * @route   GET /api/admin/stats
 * @desc    Получить общую статистику
 * @access  Admin
 */
router.get('/stats', adminController.getSystemStats);

// Leaderboard management routes
/**
 * @route   GET /api/admin/leaderboards/global
 * @desc    Получить глобальный лидерборд для админ-панели
 * @access  Admin
 */
router.get('/leaderboards/global', leaderboardController.getGlobalLeaderboard);

/**
 * @route   GET /api/admin/leaderboards/weekly
 * @desc    Получить недельный лидерборд для админ-панели
 * @access  Admin
 */
router.get('/leaderboards/weekly', leaderboardController.getWeeklyLeaderboard);

/**
 * @route   GET /api/admin/leaderboards/daily
 * @desc    Получить дневной лидерборд для админ-панели
 * @access  Admin
 */
router.get('/leaderboards/daily', leaderboardController.getDailyLeaderboard);

/**
 * @route   GET /api/admin/leaderboards/user/:userId
 * @desc    Получить позицию пользователя в лидерборде
 * @access  Admin
 */
router.get('/leaderboards/user/:userId', leaderboardController.getUserPosition);

/**
 * @route   DELETE /api/admin/leaderboards/reset/:type
 * @desc    Сбросить лидерборд определенного типа (daily, weekly, global)
 * @access  Admin
 */
router.delete('/leaderboards/reset/:type', adminController.resetLeaderboard);

/**
 * @route   GET /api/admin/leaderboards/history
 * @desc    Получить историю лидерборда за определенный период
 * @access  Admin
 */
router.get('/leaderboards/history', adminController.getLeaderboardHistory);

/**
 * @route   POST /api/admin/leaderboards/rebuild
 * @desc    Перестроить все лидерборды с нуля на основе данных игр
 * @access  Admin
 */
router.post('/leaderboards/rebuild', adminController.rebuildLeaderboards);

/**
 * @route   POST /api/admin/leaderboards/publish/:type
 * @desc    Опубликовать лидерборд в Telegram канал (daily, weekly, global)
 * @access  Admin
 */
router.post('/leaderboards/publish/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!['daily', 'weekly', 'global', 'all-time'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Недопустимый тип лидерборда. Используйте daily, weekly или global'
      });
    }
    
    // Используем leaderboardType как 'all-time' если type равен 'global'
    const leaderboardType = type === 'global' ? 'all-time' : type;
    
    const result = await leaderboardController.publishLeaderboardToTelegram(leaderboardType);
    
    if (result) {
      return res.status(200).json({
        success: true,
        message: `Лидерборд типа ${type} успешно опубликован в Telegram канал`
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Не удалось опубликовать лидерборд типа ${type} в Telegram канал`
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Ошибка при публикации лидерборда: ${error.message}`
    });
  }
});

// User management routes
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/reset-password', adminController.resetUserPassword);

// Notification routes
/**
 * @route   POST /api/admin/notifications/achievement
 * @desc    Отправить уведомление о достижении пользователю
 * @access  Admin
 */
router.post('/notifications/achievement', notificationController.sendAchievementNotification);

/**
 * @route   POST /api/admin/notifications/leaderboard
 * @desc    Отправить уведомление о позиции в рейтинге
 * @access  Admin
 */
router.post('/notifications/leaderboard', notificationController.sendLeaderboardPositionNotification);

/**
 * @route   POST /api/admin/notifications/bulk
 * @desc    Отправить массовое уведомление пользователям
 * @access  Admin
 */
router.post('/notifications/bulk', notificationController.sendBulkNotification);

/**
 * @route   POST /api/admin/notifications/channel
 * @desc    Опубликовать сообщение в Telegram канал
 * @access  Admin
 */
router.post('/notifications/channel', notificationController.publishToChannel);

// Analytics and stats routes
router.get('/stats/game', adminController.getGameStats);
router.get('/health', adminController.getSystemHealth);

module.exports = router; 