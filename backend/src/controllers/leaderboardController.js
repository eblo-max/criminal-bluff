/**
 * Контроллер для управления рейтингами
 */
const { User } = require('../models');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');
const telegramService = require('../config/telegram');
const { startTransaction, captureException } = require('../config/sentry');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorMiddleware');
const { ValidationError } = require('../utils/errors');
const { leaderboardValidationRules } = require('../middlewares/validationMiddleware');

/**
 * Контроллер лидерборда
 */
class LeaderboardController {
  constructor() {
    // Bind methods to instance
    this.getWeeklyLeaderboard = asyncHandler(this.getWeeklyLeaderboard.bind(this));
    this.getAllTimeLeaderboard = asyncHandler(this.getAllTimeLeaderboard.bind(this));
    this.getUserPosition = asyncHandler(this.getUserPosition.bind(this));
    this.getUserNeighbors = asyncHandler(this.getUserNeighbors.bind(this));
  }

  /**
   * Получить таблицу лидеров
   */
  async getWeeklyLeaderboard(req, res) {
    const { limit = 10, offset = 0 } = req.query;
    const cacheKey = `leaderboard:weekly`;
    
    let leaderboard = await cacheService.getLeaderboardCache(cacheKey);
    
    if (!leaderboard) {
      const pipeline = [
        this._getPeriodFilter('weekly'),
        {
          $group: {
            _id: '$userId',
            score: { $sum: '$score' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            username: '$user.username',
            photoUrl: '$user.photoUrl',
            score: 1
          }
        },
        { $sort: { score: -1 } }
      ];

      leaderboard = await User.aggregate(pipeline);
      await cacheService.cacheLeaderboard(cacheKey, leaderboard, 900); // 15 min TTL
    }

    const total = leaderboard.length;
    const results = leaderboard
      .slice(offset, offset + limit)
      .map((entry, index) => ({
        ...entry,
        position: offset + index + 1
      }));

    return res.success({
      results,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit)
      }
    });
  }

  /**
   * Получить таблицу лидеров
   */
  async getAllTimeLeaderboard(req, res) {
    const { limit = 10, offset = 0 } = req.query;
    const cacheKey = 'leaderboard:all-time';
    
    let leaderboard = await cacheService.getLeaderboardCache(cacheKey);
    
    if (!leaderboard) {
      const pipeline = [
        {
          $group: {
            _id: '$userId',
            score: { $sum: '$score' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            username: '$user.username',
            photoUrl: '$user.photoUrl',
            score: 1
          }
        },
        { $sort: { score: -1 } }
      ];

      leaderboard = await User.aggregate(pipeline);
      await cacheService.cacheLeaderboard(cacheKey, leaderboard, 3600); // 1 hour TTL
    }

    const total = leaderboard.length;
    const results = leaderboard
      .slice(offset, offset + limit)
      .map((entry, index) => ({
        ...entry,
        position: offset + index + 1
      }));

    return res.success({
      results,
      pagination: {
        total,
        offset: Number(offset),
        limit: Number(limit)
      }
    });
  }

  /**
   * Получить позицию пользователя в рейтинге
   */
  async getUserPosition(req, res) {
    const { userId } = req.params;
    const cacheKey = `userposition:${userId}`;
    
    let position = await cacheService.getUserPositionCache(cacheKey);
    
    if (position === null) {
      const pipeline = [
        {
          $group: {
            _id: '$userId',
            score: { $sum: '$score' }
          }
        },
        { $sort: { score: -1 } }
      ];

      const leaderboard = await User.aggregate(pipeline);
      position = leaderboard.findIndex(entry => entry._id.toString() === userId) + 1;
      
      if (position > 0) {
        await cacheService.cacheUserPosition(cacheKey, position, 300); // 5 min TTL
      }
    }

    return res.success({ position });
  }

  /**
   * Получить соседей пользователя в рейтинге
   */
  async getUserNeighbors(req, res) {
    const { userId } = req.params;
    const { range = 2 } = req.query;
    const cacheKey = `userneighbors:${userId}:${range}`;
    
    let neighbors = await cacheService.getUserNeighborsCache(cacheKey);
    
    if (!neighbors) {
      const pipeline = [
        {
          $group: {
            _id: '$userId',
            score: { $sum: '$score' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            username: '$user.username',
            photoUrl: '$user.photoUrl',
            score: 1
          }
        },
        { $sort: { score: -1 } }
      ];

      const leaderboard = await User.aggregate(pipeline);
      const userIndex = leaderboard.findIndex(entry => entry._id.toString() === userId);
      
      if (userIndex === -1) {
        throw new ValidationError('User not found in leaderboard');
      }

      const start = Math.max(0, userIndex - range);
      const end = Math.min(leaderboard.length, userIndex + range + 1);
      neighbors = leaderboard.slice(start, end).map((entry, index) => ({
        ...entry,
        position: start + index + 1
      }));

      await cacheService.cacheUserNeighbors(cacheKey, neighbors, 300); // 5 min TTL
    }

    return res.success({ neighbors });
  }

  /**
   * Получить фильтр по периоду для агрегации
   */
  _getPeriodFilter(period) {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      default:
        return {};
    }

    return {
      $match: {
        createdAt: { $gte: startDate }
      }
    };
  }
}

module.exports = new LeaderboardController();