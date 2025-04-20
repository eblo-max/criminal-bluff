/**
 * Middleware для проверки прав администратора
 * Проверяет, имеет ли пользователь права администратора
 */
const { User } = require('../models');
const logger = require('../utils/logger');

module.exports = async (req, res, next) => {
  try {
    // Пользователь должен быть аутентифицирован через authMiddleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    // Получаем полную информацию о пользователе
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем, является ли пользователь администратором
    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Доступ запрещен. Требуются права администратора'
      });
    }
    
    // Если все проверки пройдены, пользователь может получить доступ
    next();
  } catch (error) {
    logger.error(`Error in adminMiddleware: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при проверке прав доступа'
    });
  }
}; 