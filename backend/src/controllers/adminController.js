/**
 * Контроллер для административной панели
 */
const { User, Story, GameSession } = require('../models');
const logger = require('../utils/logger');
const statsService = require('../services/statsService');
const leaderboardService = require('../services/leaderboardService');
const Game = require('../models/Game');
const { sendResetPasswordEmail } = require('../services/emailService');
const crypto = require('crypto');

/**
 * Получить данные для дашборда
 */
exports.getDashboard = async (req, res) => {
  try {
    // Получаем статистику системы
    const systemStats = await statsService.getSystemStats();
    
    if (!systemStats) {
      return res.status(500).json({
        success: false,
        message: 'Не удалось получить статистику системы'
      });
    }
    
    // Получаем недавних новых пользователей
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id username firstName lastName photoUrl telegramId createdAt');
    
    // Получаем недавние игры
    const recentGames = await GameSession.find({ status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(10)
      .populate('userId', 'username firstName lastName photoUrl')
      .select('totalScore correctAnswers userId status startedAt completedAt');
    
    return res.status(200).json({
      success: true,
      message: 'Данные для дашборда успешно получены',
      data: {
        systemStats,
        recentUsers,
        recentGames
      }
    });
  } catch (error) {
    logger.error(`Error getting admin dashboard: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных для дашборда'
    });
  }
};

/**
 * Получить список историй
 */
exports.getStories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Поиск и фильтрация
    const query = {};
    
    if (req.query.difficulty) {
      query.difficulty = req.query.difficulty;
    }
    
    if (req.query.category) {
      query.category = req.query.category;
    }
    
    if (req.query.search) {
      query.$or = [
        { text: { $regex: req.query.search, $options: 'i' } },
        { options: { $elemMatch: { $regex: req.query.search, $options: 'i' } } }
      ];
    }
    
    // Получаем общее количество историй
    const total = await Story.countDocuments(query);
    
    // Получаем истории с пагинацией и сортировкой
    const stories = await Story.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id text options correctAnswer difficulty category createdAt');
    
    return res.status(200).json({
      success: true,
      message: 'Список историй успешно получен',
      stories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error(`Error getting stories list: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка историй'
    });
  }
};

/**
 * Создать новую историю
 */
exports.createStory = async (req, res) => {
  try {
    const { text, options, correctAnswer, explanation, difficulty, category } = req.body;
    
    // Проверка обязательных полей
    if (!text || !options || options.length !== 3 || correctAnswer === undefined || !explanation) {
      return res.status(400).json({
        success: false,
        message: 'Не заполнены все обязательные поля'
      });
    }
    
    // Проверка корректности индекса правильного ответа
    if (correctAnswer < 0 || correctAnswer > 2) {
      return res.status(400).json({
        success: false,
        message: 'Индекс правильного ответа должен быть от 0 до 2'
      });
    }
    
    // Создаем новую историю
    const story = new Story({
      text,
      options,
      correctAnswer,
      explanation,
      difficulty: difficulty || 'medium',
      category: category || 'general',
      createdAt: new Date()
    });
    
    await story.save();
    
    return res.status(201).json({
      success: true,
      message: 'История успешно создана',
      story
    });
  } catch (error) {
    logger.error(`Error creating story: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании истории'
    });
  }
};

/**
 * Получить информацию об истории
 */
exports.getStoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const story = await Story.findById(id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'История не найдена'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Информация об истории успешно получена',
      story
    });
  } catch (error) {
    logger.error(`Error getting story: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении информации об истории'
    });
  }
};

/**
 * Обновить историю
 */
exports.updateStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, options, correctAnswer, explanation, difficulty, category } = req.body;
    
    // Проверка наличия истории
    const story = await Story.findById(id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'История не найдена'
      });
    }
    
    // Проверка обязательных полей
    if (!text || !options || options.length !== 3 || correctAnswer === undefined || !explanation) {
      return res.status(400).json({
        success: false,
        message: 'Не заполнены все обязательные поля'
      });
    }
    
    // Проверка корректности индекса правильного ответа
    if (correctAnswer < 0 || correctAnswer > 2) {
      return res.status(400).json({
        success: false,
        message: 'Индекс правильного ответа должен быть от 0 до 2'
      });
    }
    
    // Обновляем историю
    story.text = text;
    story.options = options;
    story.correctAnswer = correctAnswer;
    story.explanation = explanation;
    story.difficulty = difficulty || story.difficulty;
    story.category = category || story.category;
    
    await story.save();
    
    return res.status(200).json({
      success: true,
      message: 'История успешно обновлена',
      story
    });
  } catch (error) {
    logger.error(`Error updating story: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении истории'
    });
  }
};

/**
 * Удалить историю
 */
exports.deleteStory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверка наличия истории
    const story = await Story.findById(id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'История не найдена'
      });
    }
    
    // Удаляем историю
    await Story.findByIdAndDelete(id);
    
    return res.status(200).json({
      success: true,
      message: 'История успешно удалена'
    });
  } catch (error) {
    logger.error(`Error deleting story: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при удалении истории'
    });
  }
};

/**
 * Получить список пользователей
 */
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find({})
      .select('username email totalScore createdAt status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments();
    
    res.status(200).json({
      users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

/**
 * Получить информацию о пользователе
 */
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get additional user stats
    const gamesPlayed = await Game.countDocuments({ userId: userId });
    const games = await Game.find({ userId: userId });
    
    const averageScore = games.length > 0
      ? games.reduce((acc, game) => acc + game.score, 0) / games.length
      : 0;
    
    const userWithStats = {
      ...user.toObject(),
      gamesPlayed,
      averageScore: Math.round(averageScore * 10) / 10
    };
    
    res.status(200).json(userWithStats);
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    res.status(500).json({ message: 'Failed to get user details' });
  }
};

/**
 * Обновить пользователя
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    
    // Проверка наличия пользователя
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Обновляем только статус администратора
    if (isAdmin !== undefined) {
      user.isAdmin = isAdmin;
    }
    
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Пользователь успешно обновлен',
      user
    });
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пользователя'
    });
  }
};

/**
 * Получить общую статистику системы
 */
exports.getSystemStats = async (req, res) => {
  try {
    const systemStats = await statsService.getSystemStats();
    
    if (!systemStats) {
      return res.status(500).json({
        success: false,
        message: 'Не удалось получить статистику системы'
      });
    }
    
    // Дополнительная статистика для админов
    const storiesCount = await Story.countDocuments();
    
    // Статистика по сложности историй
    const difficultyCounts = await Story.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);
    
    // Статистика по категориям историй
    const categoryCounts = await Story.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Добавляем информацию в системную статистику
    systemStats.stories = {
      total: storiesCount,
      byDifficulty: difficultyCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      byCategory: categoryCounts.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    };
    
    return res.status(200).json({
      success: true,
      message: 'Общая статистика успешно получена',
      stats: systemStats
    });
  } catch (error) {
    logger.error(`Error getting system stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении общей статистики'
    });
  }
};

/**
 * Update user status (active/banned)
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body;
    
    if (!status || !['active', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    logger.info(`User ${userId} status updated to ${status} by admin ${req.user._id}`);
    
    res.status(200).json({ 
      message: 'User status updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        status: user.status
      }
    });
  } catch (error) {
    logger.error('Error updating user status:', error);
    res.status(500).json({ message: 'Failed to update user status' });
  }
};

/**
 * Initiate password reset for a user
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    
    // Send reset email
    await sendResetPasswordEmail(user.email, resetToken);
    
    logger.info(`Password reset initiated for user ${userId} by admin ${req.user._id}`);
    
    res.status(200).json({ 
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    logger.error('Error resetting user password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

/**
 * Get game statistics for admin dashboard
 */
exports.getGameStats = async (req, res) => {
  try {
    // Get total number of games
    const totalGames = await Game.countDocuments();
    
    // Get count of active users (users who played at least one game)
    const activeUsers = await User.countDocuments({ 
      status: 'active',
      gamesPlayed: { $gt: 0 }
    });
    
    // Get number of games played today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const gamesToday = await Game.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Calculate average score across all games
    const gamesWithScores = await Game.find({}, 'score');
    const averageScore = gamesWithScores.length > 0
      ? gamesWithScores.reduce((acc, game) => acc + game.score, 0) / gamesWithScores.length
      : 0;
    
    // Calculate weekly stats for the last 7 days
    const weeklyStats = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await Game.countDocuments({
        createdAt: { 
          $gte: date, 
          $lt: nextDate 
        }
      });
      
      weeklyStats.push({
        day: dayNames[date.getDay()],
        date: date.toISOString().split('T')[0],
        count
      });
    }
    
    res.status(200).json({
      totalGames,
      activeUsers,
      gamesToday,
      averageScore,
      weeklyStats
    });
  } catch (error) {
    logger.error('Error getting game stats:', error);
    res.status(500).json({ message: 'Failed to get game statistics' });
  }
};

/**
 * Get system health metrics
 */
exports.getSystemHealth = async (req, res) => {
  try {
    const metrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: Date.now()
    };
    
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({ message: 'Failed to get system health' });
  }
};

/**
 * Reset leaderboard of a specific type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.resetLeaderboard = async (req, res) => {
  try {
    const { type } = req.params;
    
    if (!type || !['daily', 'weekly', 'global'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leaderboard type. Must be "daily", "weekly", or "global".'
      });
    }
    
    const redisService = require('../services/redisService');
    
    let key;
    if (type === 'daily') {
      // Reset today's leaderboard
      const today = new Date().toISOString().split('T')[0];
      key = `leaderboard:daily:${today}`;
    } else if (type === 'weekly') {
      // Reset this week's leaderboard
      const currentDate = new Date();
      const weekNumber = leaderboardService.getWeekNumber(currentDate);
      const year = currentDate.getFullYear();
      key = `leaderboard:weekly:${year}-${weekNumber}`;
    } else {
      // Reset global leaderboard
      key = 'leaderboard:all-time';
    }
    
    // Delete the Redis key
    const result = await redisService.deleteKey(key);
    
    if (result) {
      logger.info(`Admin ${req.user._id} reset the ${type} leaderboard`);
      
      // If it's the global leaderboard, also reset the user totalScore in database
      if (type === 'global') {
        await User.updateMany({}, { totalScore: 0 });
        logger.info('All users totalScore reset to 0');
      }
      
      return res.status(200).json({
        success: true,
        message: `${type} leaderboard has been reset successfully`
      });
    } else {
      return res.status(404).json({
        success: false,
        message: `Leaderboard not found or already reset`
      });
    }
  } catch (error) {
    logger.error(`Error resetting leaderboard: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset leaderboard'
    });
  }
};

/**
 * Get leaderboard history for a specific time period
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getLeaderboardHistory = async (req, res) => {
  try {
    const { period } = req.query;
    const validPeriods = ['weekly', 'daily'];
    
    if (!period || !validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "weekly" or "daily".'
      });
    }
    
    const redisService = require('../services/redisService');
    let keys = [];
    
    // Get Redis keys matching the pattern for the specified period
    if (period === 'daily') {
      // Get all daily leaderboard keys
      // Format: leaderboard:daily:YYYY-MM-DD
      const pattern = 'leaderboard:daily:*';
      keys = await redisService.getKeysByPattern(pattern);
    } else if (period === 'weekly') {
      // Get all weekly leaderboard keys
      // Format: leaderboard:weekly:YYYY-WW
      const pattern = 'leaderboard:weekly:*';
      keys = await redisService.getKeysByPattern(pattern);
    }
    
    // Filter out non-leaderboard keys
    keys = keys.filter(key => !key.includes(':expires'));
    
    // Sort keys in descending order by date
    keys.sort().reverse();
    
    // Limit to 10 most recent
    const recentKeys = keys.slice(0, 10);
    
    // For each key, get the top 3 users
    const leaderboardHistory = await Promise.all(
      recentKeys.map(async (key) => {
        const period = key.split(':')[1]; // 'daily' or 'weekly'
        const dateStr = key.split(':')[2]; // 'YYYY-MM-DD' or 'YYYY-WW'
        
        // Get top 3 users from the leaderboard
        const top3 = await redisService.getLeaderboardRange(key, 0, 2);
        
        // Get user details for each ID in the top 3
        const userDetails = await Promise.all(
          top3.map(async (entry) => {
            const user = await User.findById(entry.id).select('username firstName lastName photoUrl');
            
            return {
              id: entry.id,
              score: entry.score,
              username: user ? user.username : 'Unknown User',
              name: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
              photoUrl: user ? user.photoUrl : null
            };
          })
        );
        
        return {
          key,
          period,
          date: dateStr,
          leaders: userDetails
        };
      })
    );
    
    return res.status(200).json({
      success: true,
      message: `${period} leaderboard history retrieved successfully`,
      history: leaderboardHistory
    });
    
  } catch (error) {
    logger.error(`Error getting leaderboard history: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard history'
    });
  }
};

/**
 * Rebuild leaderboards from game data
 * This is useful if leaderboards have been corrupted or lost
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.rebuildLeaderboards = async (req, res) => {
  try {
    const redisService = require('../services/redisService');
    
    // Clear existing leaderboards first
    // Get all leaderboard keys
    const allKeys = await redisService.getKeysByPattern('leaderboard:*');
    
    // Delete all leaderboard keys
    if (allKeys.length > 0) {
      await Promise.all(allKeys.map(key => redisService.deleteKey(key)));
      logger.info(`Deleted ${allKeys.length} leaderboard keys for rebuild`);
    }
    
    // Reset user totalScore in database
    await User.updateMany({}, { totalScore: 0 });
    
    // Get all completed games
    const games = await Game.find({ status: 'completed' })
      .sort({ completedAt: 1 }) // Process in chronological order
      .select('userId score completedAt');
    
    if (games.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No games found to rebuild leaderboards'
      });
    }
    
    // Group games by user
    const userGames = {};
    
    games.forEach(game => {
      if (!userGames[game.userId]) {
        userGames[game.userId] = [];
      }
      userGames[game.userId].push(game);
    });
    
    // Rebuild leaderboards for each user
    for (const userId in userGames) {
      let totalScore = 0;
      
      // Process each game for this user
      for (const game of userGames[userId]) {
        const gameScore = game.score || 0;
        totalScore += gameScore;
        
        // Update user's total score in database
        await User.findByIdAndUpdate(userId, { totalScore });
        
        // Update leaderboards using the leaderboard service
        const completedAt = game.completedAt || new Date();
        
        // Generate keys for the day and week of this game
        const gameDate = new Date(completedAt);
        const dayKey = `leaderboard:daily:${gameDate.toISOString().split('T')[0]}`;
        
        const weekNumber = leaderboardService.getWeekNumber(gameDate);
        const year = gameDate.getFullYear();
        const weekKey = `leaderboard:weekly:${year}-${weekNumber}`;
        
        // Update daily leaderboard (score for this game only)
        await redisService.addToSortedSet(dayKey, gameScore, userId);
        
        // Update weekly leaderboard
        const currentWeeklyScore = await redisService.getScore(weekKey, userId) || 0;
        await redisService.addToSortedSet(weekKey, currentWeeklyScore + gameScore, userId);
        
        // Update all-time leaderboard with total score
        await redisService.addToSortedSet('leaderboard:all-time', totalScore, userId);
      }
    }
    
    // Set expiry for all daily and weekly leaderboards
    const dailyKeys = await redisService.getKeysByPattern('leaderboard:daily:*');
    const weeklyKeys = await redisService.getKeysByPattern('leaderboard:weekly:*');
    
    // Set 24-hour expiry for daily leaderboards 
    // (use a long time for historical ones, but they'll eventually expire)
    for (const key of dailyKeys) {
      await redisService.setValue(`${key}:expires`, 1, 86400); 
    }
    
    // Set 7-day expiry for weekly leaderboards
    for (const key of weeklyKeys) {
      await redisService.setValue(`${key}:expires`, 1, 604800);
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully rebuilt leaderboards from ${games.length} games`,
      stats: {
        users: Object.keys(userGames).length,
        games: games.length,
        dailyLeaderboards: dailyKeys.length,
        weeklyLeaderboards: weeklyKeys.length
      }
    });
  } catch (error) {
    logger.error(`Error rebuilding leaderboards: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to rebuild leaderboards'
    });
  }
}; 