/**
 * Маршруты для Telegram WebApp API
 * Обработка запросов от мини-приложения Telegram
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { webAppAuthMiddleware } = require('../middlewares/webAppMiddleware');

/**
 * @route   POST /api/webapp/auth
 * @desc    Авторизация через Telegram WebApp
 * @access  Public
 */
router.post('/auth', userController.telegramAuth);

/**
 * @route   GET /api/webapp/config
 * @desc    Получить конфигурацию WebApp
 * @access  Private
 */
router.get('/config', webAppAuthMiddleware, userController.getWebAppConfig);

/**
 * @route   GET /api/webapp/validate
 * @desc    Проверить валидность данных Telegram WebApp
 * @access  Public
 */
router.post('/validate', (req, res) => {
  const { initData } = req.body;
  
  if (!initData) {
    return res.status(400).json({
      success: false,
      message: 'Отсутствуют данные инициализации'
    });
  }
  
  try {
    const { verifyTelegramWebAppData } = require('../middlewares/webAppMiddleware');
    const isValid = verifyTelegramWebAppData(initData);
    
    return res.status(200).json({
      success: true,
      valid: isValid
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Ошибка при проверке данных: ${error.message}`
    });
  }
});

/**
 * @route   GET /api/webapp/theme
 * @desc    Получить настройки темы для WebApp
 * @access  Public
 */
router.get('/theme', (req, res) => {
  // Базовая тема по умолчанию
  const defaultTheme = {
    background_color: '#1E1E1E',
    text_color: '#FFFFFF',
    hint_color: '#AAAAAA',
    link_color: '#5288C1',
    button_color: '#5288C1',
    button_text_color: '#FFFFFF',
    secondary_bg_color: '#2A2A2A'
  };
  
  // Если есть данные из Telegram, используем их
  if (req.telegramWebApp) {
    const params = new URLSearchParams(req.headers['telegram-data'] || req.body.initData || '');
    
    try {
      const themeParams = JSON.parse(params.get('theme_params') || '{}');
      
      // Если есть параметры темы от Telegram, используем их
      if (Object.keys(themeParams).length > 0) {
        return res.status(200).json({
          success: true,
          theme: themeParams
        });
      }
    } catch (error) {
      console.error('Ошибка разбора параметров темы:', error);
    }
  }
  
  // Возвращаем тему по умолчанию, если не получили от Telegram
  return res.status(200).json({
    success: true,
    theme: defaultTheme
  });
});

module.exports = router; 