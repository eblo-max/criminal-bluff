// Используем ioredis-mock в тестах
const Redis = process.env.NODE_ENV === 'test'
  ? require('ioredis-mock')
  : require('ioredis');

const logger = require('../utils/logger');

// Оптимизированные TTL для разных типов данных (в секундах)
const TTL = {
  GAME_SESSION: 3600,      // 1 час для активной игровой сессии
  USER_PROFILE: {
    DEFAULT: 1800,         // 30 минут для обычного профиля
    ACTIVE: 300,           // 5 минут для активного игрока
    INACTIVE: 3600         // 1 час для неактивного игрока
  },
  LEADERBOARD: {
    DAILY: 300,           // 5 минут для дневного рейтинга
    WEEKLY: 900,          // 15 минут для недельного рейтинга
    MONTHLY: 1800,        // 30 минут для месячного рейтинга
    ALL_TIME: 3600        // 1 час для общего рейтинга
  },
  ACHIEVEMENTS: {
    PROGRESS: 600,        // 10 минут для прогресса достижений
    LIST: 3600,           // 1 час для списка достижений
    UNLOCKED: 86400       // 24 часа для разблокированных достижений
  },
  STORIES: 86400,         // 24 часа для историй
  RANK: 1800             // 30 минут для ранга
};

// Ключи для кэша
const CACHE_KEYS = {
  GAME_SESSION: 'game:session:',
  USER_PROFILE: 'user:profile:',
  LEADERBOARD: 'leaderboard:',
  ACHIEVEMENTS: {
    PROGRESS: 'achievements:progress:',
    LIST: 'achievements:list:',
    UNLOCKED: 'achievements:unlocked:'
  },
  STORIES: 'stories:',
  RANK: 'rank:'
};

const USER_ACHIEVEMENTS_KEY = (userId) => `user:${userId}:achievements`;
const USER_ACHIEVEMENTS_TTL = 3600; // 1 hour

class CacheService {
  constructor() {
    this.client = process.env.NODE_ENV === 'test' ? new Redis() : null;
    this.isConnected = process.env.NODE_ENV === 'test';
    this.retryAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;

    // Cache TTL constants (in seconds)
    this.TTL = TTL;

    // Cache key prefixes
    this.KEYS = CACHE_KEYS;

    // Leaderboard cache keys
    this.LEADERBOARD_CACHE_KEY = 'leaderboard';
    this.LEADERBOARD_CACHE_TTL = 300; // 5 minutes

    // Добавляем интервал для очистки устаревших данных
    this.cleanupInterval = 3600000; // 1 час
    if (process.env.NODE_ENV !== 'test') {
      this.startCleanupInterval();
    }
  }

  async connect() {
    try {
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      if (this.client) {
        return;
      }

      this.client = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times) => {
          if (times > this.maxRetries) {
            return null;
          }
          return this.retryDelay;
        },
        enableOfflineQueue: true,
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.retryAttempts = 0;
        logger.info('Successfully connected to Redis');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error(`Redis error: ${error.message}`);
        this.handleConnectionError();
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
        this.handleConnectionError();
      });

    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error.message}`);
      throw error;
    }
  }

  async handleConnectionError() {
    if (this.retryAttempts >= this.maxRetries) {
      logger.error('Max Redis reconnection attempts reached');
      return;
    }

    this.retryAttempts++;
    logger.info(`Attempting to reconnect to Redis (attempt ${this.retryAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Redis reconnection failed: ${error.message}`);
      }
    }, this.retryDelay);
  }

  async get(key) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;

    } catch (error) {
      logger.error(`Redis get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key, data, expiration = 3600) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.setex(key, expiration, JSON.stringify(data));
      return true;

    } catch (error) {
      logger.error(`Redis set error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.del(key);
      return true;

    } catch (error) {
      logger.error(`Redis del error for key ${key}: ${error.message}`);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;

    } catch (error) {
      logger.error(`Redis invalidatePattern error for pattern ${pattern}: ${error.message}`);
      return false;
    }
  }

  // Helper methods for specific cache operations
  async cacheStories(stories) {
    return this.set(this.KEYS.STORIES, stories, this.TTL.STORIES);
  }

  async getStoriesCache() {
    return this.get(this.KEYS.STORIES);
  }

  /**
   * Получить оптимальный TTL для профиля пользователя
   */
  getProfileTTL(user) {
    const lastActive = new Date(user.lastActive || user.updatedAt || user.createdAt);
    const hoursSinceActive = (Date.now() - lastActive) / (1000 * 3600);

    if (hoursSinceActive < 1) {
      return this.TTL.USER_PROFILE.ACTIVE;
    } else if (hoursSinceActive > 24) {
      return this.TTL.USER_PROFILE.INACTIVE;
    }
    return this.TTL.USER_PROFILE.DEFAULT;
  }

  /**
   * Получить TTL для лидерборда
   */
  getLeaderboardTTL(period) {
    switch (period) {
      case 'daily':
        return this.TTL.LEADERBOARD.DAILY;
      case 'weekly':
        return this.TTL.LEADERBOARD.WEEKLY;
      case 'monthly':
        return this.TTL.LEADERBOARD.MONTHLY;
      default:
        return this.TTL.LEADERBOARD.ALL_TIME;
    }
  }

  /**
   * Кэширование профиля с оптимальным TTL
   */
  async cacheUserProfile(userId, profile) {
    const ttl = this.getProfileTTL(profile);
    const key = this.KEYS.USER_PROFILE + userId;
    return this.set(key, profile, ttl);
  }

  async getUserProfileCache(userId) {
    return this.get(this.KEYS.USER_PROFILE + userId);
  }

  async cacheUserAchievements(userId, achievementsData) {
    return this.set(this.KEYS.ACHIEVEMENTS.LIST + userId, achievementsData, this.TTL.ACHIEVEMENTS.LIST);
  }

  async getUserAchievementsCache(userId) {
    return this.get(this.KEYS.ACHIEVEMENTS.LIST + userId);
  }

  /**
   * Кэширование лидерборда с оптимальным TTL
   */
  async cacheLeaderboard(period, data) {
    const ttl = this.getLeaderboardTTL(period);
    const key = this.KEYS.LEADERBOARD + period;
    return this.set(key, data, ttl);
  }

  async getLeaderboardCache(type) {
    return this.get(this.KEYS.LEADERBOARD + type);
  }

  /**
   * Кэширование прогресса достижений
   */
  async cacheAchievementProgress(userId, progress) {
    const key = this.KEYS.ACHIEVEMENTS.PROGRESS + userId;
    return this.set(key, progress, this.TTL.ACHIEVEMENTS.PROGRESS);
  }

  /**
   * Кэширование разблокированных достижений
   */
  async cacheUnlockedAchievements(userId, achievements) {
    const key = this.KEYS.ACHIEVEMENTS.UNLOCKED + userId;
    return this.set(key, achievements, this.TTL.ACHIEVEMENTS.UNLOCKED);
  }

  async invalidateUserCaches(userId) {
    const patterns = [
      this.KEYS.USER_PROFILE + userId,
      this.KEYS.ACHIEVEMENTS.PROGRESS + userId,
      this.KEYS.ACHIEVEMENTS.UNLOCKED + userId,
      this.KEYS.RANK + userId
    ];

    await Promise.all(patterns.map(pattern => this.invalidatePattern(pattern)));
  }

  async invalidateLeaderboardCache() {
    await this.invalidatePattern(this.KEYS.LEADERBOARD + '*');
  }

  // Leaderboard cache methods
  async getLeaderboardCachePeriod(period) {
    try {
      const key = `${this.LEADERBOARD_CACHE_KEY}:${period}`;
      const cachedData = await this.get(key);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      logger.error(`Error getting leaderboard cache: ${error.message}`);
      return null;
    }
  }

  async cacheLeaderboardPeriod(period, leaderboardData) {
    try {
      const key = `${this.LEADERBOARD_CACHE_KEY}:${period}`;
      await this.set(key, JSON.stringify(leaderboardData), this.LEADERBOARD_CACHE_TTL);
    } catch (error) {
      logger.error(`Error caching leaderboard: ${error.message}`);
    }
  }

  async invalidateLeaderboardCachePeriod(period) {
    try {
      const key = `${this.LEADERBOARD_CACHE_KEY}:${period}`;
      await this.del(key);
    } catch (error) {
      logger.error(`Error invalidating leaderboard cache: ${error.message}`);
    }
  }

  // New methods for game session, rank, and achievement progress
  async getGameSession(userId) {
    try {
      const key = this.KEYS.GAME_SESSION + userId;
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`Redis error getting game session: ${err.message}`);
      return null;
    }
  }

  async cacheGameSession(userId, session) {
    try {
      const key = this.KEYS.GAME_SESSION + userId;
      await this.set(key, JSON.stringify(session), this.TTL.GAME_SESSION);
    } catch (err) {
      logger.error(`Redis error caching game session: ${err.message}`);
    }
  }

  async invalidateGameSession(userId) {
    try {
      const key = this.KEYS.GAME_SESSION + userId;
      await this.del(key);
    } catch (err) {
      logger.error(`Redis error invalidating game session: ${err.message}`);
    }
  }

  async getAchievementProgress(userId) {
    try {
      const key = this.KEYS.ACHIEVEMENTS.PROGRESS + userId;
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`Redis error getting achievement progress: ${err.message}`);
      return null;
    }
  }

  async getUserRank(userId) {
    try {
      const key = this.KEYS.RANK + userId;
      const data = await this.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`Redis error getting user rank: ${err.message}`);
      return null;
    }
  }

  async cacheUserRank(userId, rank) {
    try {
      const key = this.KEYS.RANK + userId;
      await this.set(key, JSON.stringify(rank), this.TTL.RANK);
    } catch (err) {
      logger.error(`Redis error caching user rank: ${err.message}`);
    }
  }

  async invalidateUserRank(userId) {
    try {
      const key = this.KEYS.RANK + userId;
      await this.del(key);
    } catch (err) {
      logger.error(`Redis error invalidating user rank: ${err.message}`);
    }
  }

  /**
   * Запуск периодической очистки кэша
   */
  startCleanupInterval() {
    setInterval(async () => {
      try {
        await this.cleanupExpiredKeys();
      } catch (error) {
        logger.error(`Cache cleanup error: ${error.message}`);
      }
    }, this.cleanupInterval);
  }

  /**
   * Очистка устаревших ключей
   */
  async cleanupExpiredKeys() {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys('*');
      const now = Date.now();

      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        
        // Если TTL истек или близок к истечению (осталось менее 5 минут)
        if (ttl <= 300) {
          await this.del(key);
          logger.debug(`Cleaned up expired key: ${key}`);
        }
      }
    } catch (error) {
      logger.error(`Error cleaning up expired keys: ${error.message}`);
    }
  }

  async getUserAchievementsCache(userId) {
    const data = await this.get(USER_ACHIEVEMENTS_KEY(userId));
    return data ? JSON.parse(data) : null;
  }

  async cacheUserAchievements(userId, achievements) {
    await this.set(
      USER_ACHIEVEMENTS_KEY(userId),
      USER_ACHIEVEMENTS_TTL,
      JSON.stringify(achievements)
    );
  }

  async invalidateUserAchievementsCache(userId) {
    await this.del(USER_ACHIEVEMENTS_KEY(userId));
  }
}

// Create and export singleton instance
const cacheService = new CacheService();
module.exports = cacheService; 