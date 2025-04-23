/**
 * Redis service for caching and real-time data
 */
const Redis = require('ioredis');
const config = require('../config/redis');
const logger = require('../utils/logger');

const redis = new Redis(config);

/**
 * Получить значение по ключу
 */
const get = async (key) => {
  try {
    return await redis.get(key);
  } catch (err) {
    logger.error(`Redis get error: ${err.message}`);
    throw err;
  }
};

/**
 * Установить значение по ключу
 */
const set = async (key, value, ttl = null) => {
  try {
    if (ttl) {
      return await redis.set(key, value, 'EX', ttl);
    }
    return await redis.set(key, value);
  } catch (err) {
    logger.error(`Redis set error: ${err.message}`);
    throw err;
  }
};

/**
 * Удалить ключ
 */
const del = async (key) => {
  try {
    return await redis.del(key);
  } catch (err) {
    logger.error(`Redis del error: ${err.message}`);
    throw err;
  }
};

/**
 * Проверить существование ключа
 */
const exists = async (key) => {
  try {
    return await redis.exists(key);
  } catch (err) {
    logger.error(`Redis exists error: ${err.message}`);
    throw err;
  }
};

/**
 * Установить время жизни ключа
 */
const expire = async (key, seconds) => {
  try {
    return await redis.expire(key, seconds);
  } catch (err) {
    logger.error(`Redis expire error: ${err.message}`);
    throw err;
  }
};

/**
 * Добавить элемент в сортированное множество
 */
const addToSortedSet = async (key, score, member) => {
  try {
    return await redis.zadd(key, score, member);
  } catch (err) {
    logger.error(`Redis zadd error: ${err.message}`);
    throw err;
  }
};

/**
 * Получить ранг элемента в сортированном множестве
 */
const getRank = async (key, member) => {
  try {
    return await redis.zrevrank(key, member);
  } catch (err) {
    logger.error(`Redis zrevrank error: ${err.message}`);
    throw err;
  }
};

/**
 * Получить счет элемента в сортированном множестве
 */
const getScore = async (key, member) => {
  try {
    return await redis.zscore(key, member);
  } catch (err) {
    logger.error(`Redis zscore error: ${err.message}`);
    throw err;
  }
};

/**
 * Получить диапазон элементов из сортированного множества
 */
const getRange = async (key, start, stop, withScores = true) => {
  try {
    if (withScores) {
      return await redis.zrevrange(key, start, stop, 'WITHSCORES');
    }
    return await redis.zrevrange(key, start, stop);
  } catch (err) {
    logger.error(`Redis zrevrange error: ${err.message}`);
    throw err;
  }
};

/**
 * Получить количество элементов в сортированном множестве
 */
const getCount = async (key) => {
  try {
    return await redis.zcard(key);
  } catch (err) {
    logger.error(`Redis zcard error: ${err.message}`);
    throw err;
  }
};

/**
 * Получить ранг пользователя в рейтинге
 * @param {string} userId - ID пользователя
 * @param {string} leaderboardKey - Ключ рейтинга
 * @returns {Promise<number|null>} - Ранг пользователя или null
 */
const getUserRank = async (userId, leaderboardKey) => {
  try {
    const rank = await redis.zrevrank(leaderboardKey, userId);
    return rank !== null ? rank + 1 : null; // Преобразуем в 1-based индекс
  } catch (err) {
    logger.error(`Redis getUserRank error: ${err.message}`);
    throw err;
  }
};

/**
 * Удалить ключ
 * @param {string} key - Ключ для удаления
 * @returns {Promise<boolean>} - Результат операции
 */
const deleteKey = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (err) {
    logger.error(`Redis deleteKey error: ${err.message}`);
    return false;
  }
};

/**
 * Получить ключи по шаблону
 * @param {string} pattern - Шаблон для поиска ключей
 * @returns {Promise<string[]>} - Массив найденных ключей
 */
const getKeysByPattern = async (pattern) => {
  try {
    return await redis.keys(pattern);
  } catch (err) {
    logger.error(`Redis getKeysByPattern error: ${err.message}`);
    return [];
  }
};

module.exports = {
  get,
  set,
  del,
  exists,
  expire,
  addToSortedSet,
  getRank,
  getScore,
  getRange,
  getCount,
  getUserRank,
  deleteKey,
  getKeysByPattern,
  redis
}; 