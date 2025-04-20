/**
 * Redis service for caching and real-time data
 */
const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    // Error handling
    redisClient.on('error', (err) => {
      logger.error(`Redis error: ${err}`);
    });

    // Connection successful
    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    // Connect to Redis
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    throw error;
  }
};

/**
 * Set a value in Redis with optional expiration
 * @param {string} key - Redis key
 * @param {any} value - Value to store (will be JSON stringified)
 * @param {number} [expireSeconds=3600] - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<void>}
 */
const setValue = async (key, value, expireSeconds = 3600) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    await redisClient.set(key, stringValue);
    await redisClient.expire(key, expireSeconds);
  } catch (error) {
    logger.error(`Redis setValue error: ${error.message}`);
    throw error;
  }
};

/**
 * Get a value from Redis
 * @param {string} key - Redis key
 * @returns {Promise<any>} - Retrieved value (JSON parsed if possible)
 */
const getValue = async (key) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    const value = await redisClient.get(key);
    
    if (!value) return null;
    
    // Try to parse as JSON, return original value if not valid JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  } catch (error) {
    logger.error(`Redis getValue error: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a key from Redis
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} - True if key was deleted, false otherwise
 */
const deleteKey = async (key) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    const result = await redisClient.del(key);
    return result > 0;
  } catch (error) {
    logger.error(`Redis deleteKey error: ${error.message}`);
    throw error;
  }
};

/**
 * Add value to a sorted set
 * @param {string} key - Sorted set key
 * @param {number} score - Score for ordering
 * @param {string} member - Member value
 * @returns {Promise<void>}
 */
const addToSortedSet = async (key, score, member) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    await redisClient.zAdd(key, [{ score, value: member }]);
  } catch (error) {
    logger.error(`Redis addToSortedSet error: ${error.message}`);
    throw error;
  }
};

/**
 * Get top members from a sorted set
 * @param {string} key - Sorted set key
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} - Array of [member, score] pairs
 */
const getTopFromSortedSet = async (key, start = 0, end = 9) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    // Get top scores (highest first)
    const result = await redisClient.zRangeWithScores(key, start, end, { REV: true });
    return result.map(item => ({ member: item.value, score: item.score }));
  } catch (error) {
    logger.error(`Redis getTopFromSortedSet error: ${error.message}`);
    throw error;
  }
};

/**
 * Get rank of a member in a sorted set
 * @param {string} key - Sorted set key
 * @param {string} member - Member value
 * @returns {Promise<number|null>} - Rank of the member (0-based) or null if not found
 */
const getRankInSortedSet = async (key, member) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    // Get rank (reversed to get highest first)
    const rank = await redisClient.zRevRank(key, member);
    return rank;
  } catch (error) {
    logger.error(`Redis getRankInSortedSet error: ${error.message}`);
    throw error;
  }
};

/**
 * Get a range of members from a leaderboard (sorted set)
 * @param {string} key - Leaderboard key
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} - Array of {id, score} objects
 */
const getLeaderboardRange = async (key, start = 0, end = 9) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    // Get range of scores (highest first)
    const result = await redisClient.zRangeWithScores(key, start, end, { REV: true });
    return result.map(item => ({ id: item.value, score: item.score }));
  } catch (error) {
    logger.error(`Redis getLeaderboardRange error: ${error.message}`);
    throw error;
  }
};

/**
 * Get the size of a leaderboard (sorted set)
 * @param {string} key - Leaderboard key
 * @returns {Promise<number>} - Number of members in the leaderboard
 */
const getLeaderboardSize = async (key) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    return await redisClient.zCard(key);
  } catch (error) {
    logger.error(`Redis getLeaderboardSize error: ${error.message}`);
    throw error;
  }
};

/**
 * Get a user's rank in a leaderboard
 * @param {string} key - Leaderboard key
 * @param {string} userId - User ID
 * @returns {Promise<number|null>} - User's rank (0-based) or null if not found
 */
const getRank = async (key, userId) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    // Get rank (reversed to get highest first, with highest rank at 0)
    return await redisClient.zRevRank(key, userId);
  } catch (error) {
    logger.error(`Redis getRank error: ${error.message}`);
    throw error;
  }
};

/**
 * Get a user's score in a leaderboard
 * @param {string} key - Leaderboard key
 * @param {string} userId - User ID
 * @returns {Promise<number|null>} - User's score or null if not found
 */
const getScore = async (key, userId) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    return await redisClient.zScore(key, userId);
  } catch (error) {
    logger.error(`Redis getScore error: ${error.message}`);
    throw error;
  }
};

/**
 * Get all keys matching a pattern
 * @param {string} pattern - Redis key pattern with wildcards
 * @returns {Promise<Array<string>>} - Array of matching keys
 */
const getKeysByPattern = async (pattern) => {
  try {
    if (!redisClient || !redisClient.isOpen) {
      await initRedis();
    }
    
    // Use SCAN to get keys matching pattern
    const keys = [];
    let cursor = 0;
    
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100
      });
      
      cursor = result.cursor;
      keys.push(...result.keys);
    } while (cursor !== 0);
    
    return keys;
  } catch (error) {
    logger.error(`Redis getKeysByPattern error: ${error.message}`);
    throw error;
  }
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

module.exports = {
  initRedis,
  setValue,
  getValue,
  deleteKey,
  addToSortedSet,
  getTopFromSortedSet,
  getRankInSortedSet,
  getLeaderboardRange,
  getLeaderboardSize,
  getRank,
  getScore,
  getKeysByPattern,
  closeRedis
}; 