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

/**
 * @route   POST /api/webapp/check-session
 * @desc    Проверить сессию по сохраненному хешу
 * @access  Public
 */
router.post('/check-session', async (req, res) => {
  try {
    const { hash } = req.body;
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует хеш сессии'
      });
    }
    
    // В режиме отладки возвращаем успешный ответ без проверки
    if (process.env.ALLOW_DEBUG_LOGIN === 'true') {
      logger.warn('Проверка сессии в режиме отладки, пропускаем проверку хеша');
      
      // Используем админа или создаем тестового пользователя
      const User = require('../models/User');
      const adminId = process.env.ADMIN_TELEGRAM_ID || 5428724191;
      
      let user = await User.findOne({ telegramId: parseInt(adminId) });
      
      if (!user) {
        user = new User({
          telegramId: parseInt(adminId),
          username: `debug_user`,
          firstName: 'Debug',
          lastName: 'User',
          registeredAt: new Date(),
          score: 100,
          gamesPlayed: 5,
          achievements: []
        });
        
        await user.save();
        logger.info(`Created debug user with ID: ${user.telegramId}`);
      }
      
      // Генерируем JWT токен
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { telegramId: user.telegramId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Сессия восстановлена в режиме отладки',
        token,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl || '',
          score: user.score,
          gamesPlayed: user.gamesPlayed
        }
      });
    }
    
    // В продакшн режиме нужна более сложная логика восстановления сессии
    // Здесь должна быть ваша логика проверки хеша и восстановления сессии
    // Например, через Redis или другой механизм хранения
    
    logger.warn('Функция проверки сессии по хешу не полностью реализована');
    return res.status(501).json({
      success: false,
      message: 'Функция проверки сессии по хешу в разработке'
    });
    
  } catch (error) {
    logger.error(`Ошибка проверки сессии: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при проверке сессии'
    });
  }
});

/**
 * @route   GET /api/webapp/debug
 * @desc    Отладочный режим для WebApp
 * @access  Public
 */
router.get('/debug', (req, res) => {
  // Проверяем, что отладка разрешена
  if (process.env.ALLOW_DEBUG_LOGIN !== 'true' && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Отладка не разрешена в продакшн режиме'
    });
  }
  
  // Возвращаем HTML для отладки
  const debugHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Telegram WebApp Debug</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: #fff; }
        .container { max-width: 600px; margin: 0 auto; }
        .btn { background: #2481cc; color: white; border: none; padding: 10px 15px; border-radius: 5px; margin: 10px 0; cursor: pointer; }
        .card { background: #2a2a2a; padding: 15px; border-radius: 8px; margin: 15px 0; }
        pre { background: #333; padding: 10px; border-radius: 4px; overflow-x: auto; color: #fff; }
        .success { color: #4dff7c; }
        .error { color: #ff4d4d; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Отладка Telegram WebApp</h1>
        <div class="card">
          <h3>Диагностика:</h3>
          <ul>
            <li>ALLOW_DEBUG_LOGIN: ${process.env.ALLOW_DEBUG_LOGIN === 'true' ? 'включен' : 'выключен'}</li>
            <li>NODE_ENV: ${process.env.NODE_ENV}</li>
            <li>SKIP_TELEGRAM_AUTH: ${process.env.SKIP_TELEGRAM_AUTH === 'true' ? 'включен' : 'выключен'}</li>
          </ul>
        </div>
        
        <div class="card">
          <h3>Отладочный вход:</h3>
          <button id="debugLogin" class="btn">Выполнить отладочный вход</button>
          <div id="loginResult"></div>
        </div>
        
        <div class="card">
          <h3>Текущая сессия:</h3>
          <div id="sessionInfo">Не авторизован</div>
          <button id="checkSession" class="btn">Проверить сессию</button>
          <button id="clearSession" class="btn">Очистить сессию</button>
        </div>
      </div>
      
      <script>
        // Функция отображения результата
        function showResult(elementId, success, message, data) {
          const element = document.getElementById(elementId);
          element.innerHTML = \`<p class="\${success ? 'success' : 'error'}">\${message}</p>\`;
          if (data) {
            element.innerHTML += \`<pre>\${JSON.stringify(data, null, 2)}</pre>\`;
          }
        }
        
        // Отладочный вход
        document.getElementById('debugLogin').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/debug-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (result.success) {
              localStorage.setItem('auth_token', result.token);
              if (result.user) {
                localStorage.setItem('user_data', JSON.stringify(result.user));
              }
              showResult('loginResult', true, 'Успешный вход', result);
            } else {
              showResult('loginResult', false, 'Ошибка входа', result);
            }
          } catch (error) {
            showResult('loginResult', false, \`Ошибка: \${error.message}\`);
          }
        });
        
        // Проверка сессии
        document.getElementById('checkSession').addEventListener('click', () => {
          const token = localStorage.getItem('auth_token');
          const userData = localStorage.getItem('user_data');
          
          if (token) {
            const user = userData ? JSON.parse(userData) : null;
            showResult('sessionInfo', true, 'Активная сессия', { token, user });
          } else {
            showResult('sessionInfo', false, 'Нет активной сессии');
          }
        });
        
        // Очистка сессии
        document.getElementById('clearSession').addEventListener('click', () => {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user_data');
          localStorage.removeItem('tg_init_data');
          localStorage.removeItem('tg_hash');
          showResult('sessionInfo', true, 'Сессия очищена');
        });
        
        // Проверяем сессию при загрузке
        window.onload = () => {
          document.getElementById('checkSession').click();
        };
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  return res.send(debugHtml);
});

/**
 * @route   POST /api/webapp/validate-debug
 * @desc    Подробная проверка валидности данных Telegram WebApp с информацией для отладки
 * @access  Public
 */
router.post('/validate-debug', (req, res) => {
  const { initData } = req.body;
  
  if (!initData) {
    return res.status(400).json({
      success: false,
      message: 'Отсутствуют данные инициализации'
    });
  }
  
  try {
    const crypto = require('crypto');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    // Парсим данные
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const debugInfo = {};
    
    // Проверяем наличие hash
    debugInfo.hashPresent = Boolean(hash);
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует хеш в данных',
        debugInfo
      });
    }
    
    // Удаляем hash для проверки
    params.delete('hash');
    
    // Сортируем параметры
    const paramsList = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    debugInfo.paramsCount = params.size;
    debugInfo.paramsListLength = paramsList.length;
    debugInfo.firstParams = Object.fromEntries(
      Array.from(params.entries()).slice(0, 3)
    );
    
    // Проверка времени
    const authDate = params.get('auth_date');
    const currentTime = Math.floor(Date.now() / 1000);
    debugInfo.authDate = authDate;
    debugInfo.currentTime = currentTime;
    debugInfo.timeDiff = currentTime - parseInt(authDate || '0');
    debugInfo.isTimeValid = debugInfo.timeDiff < 24 * 60 * 60;
    
    // Генерируем ключ и хеш
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(paramsList)
      .digest('hex');
    
    const isValid = hash === expectedHash;
    
    debugInfo.receivedHash = hash;
    debugInfo.expectedHash = expectedHash;
    debugInfo.hashMatches = isValid;
    
    return res.status(200).json({
      success: true,
      valid: isValid,
      message: isValid ? 'Данные валидны' : 'Данные не валидны',
      debugInfo
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Ошибка при проверке данных: ${error.message}`,
      error: error.stack
    });
  }
});

module.exports = router; 