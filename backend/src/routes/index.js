/**
 * API Routes
 * Центральный файл для организации всех маршрутов API
 */
const express = require('express');
const gameRoutes = require('./gameRoutes');
const userRoutes = require('./userRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const telegramRoutes = require('./telegramRoutes');
const adminRoutes = require('./adminRoutes');
const webAppRoutes = require('./webAppRoutes');
const authMiddleware = require('../middlewares/authMiddleware');
const { webAppDataMiddleware } = require('../middlewares/webAppMiddleware');

const router = express.Router();

// Применяем webAppDataMiddleware для всех запросов, чтобы автоматически добавлять 
// данные Telegram WebApp, если они есть
router.use(webAppDataMiddleware);

// Маршруты для WebApp API
router.use('/webapp', webAppRoutes);

// Маршруты для пользователей
router.use('/user', userRoutes);

// Маршруты для игры (требуют авторизации)
router.use('/game', authMiddleware, gameRoutes);

// Маршруты для лидерборда (требуют авторизации)
router.use('/leaderboard', authMiddleware, leaderboardRoutes);

// Маршруты для админов (проверка админ-прав происходит внутри)
router.use('/admin', adminRoutes);

module.exports = router; 