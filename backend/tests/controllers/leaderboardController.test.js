const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models');
const cacheService = require('../../src/services/cacheService');
const { generateToken } = require('../../src/utils/tokenGenerator');

describe('Leaderboard Controller', () => {
  let users = [];
  let token;

  beforeEach(async () => {
    // Создаем тестовых пользователей с разными очками
    const userPromises = Array.from({ length: 5 }, (_, i) => 
      User.create({
        telegramId: `${1000000 + i}`,
        username: `user${i}`,
        firstName: `User${i}`,
        lastName: 'Test',
        score: (5 - i) * 100,
        gamesPlayed: 5,
        accuracy: 80 + i,
        averageTime: 5000 - i * 1000
      })
    );

    users = await Promise.all(userPromises);
    token = generateToken(users[0]);
  });

  describe('GET /api/leaderboard', () => {
    it('should get score leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboard?type=score')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(5);
      expect(response.body.data.results[0].score).toBe(500);
    });

    it('should get accuracy leaderboard', async () => {
      const response = await request(app)
        .get('/api/leaderboard?type=accuracy')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(5);
      expect(response.body.data.results[0].accuracy).toBeGreaterThan(80);
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/leaderboard?limit=2&offset=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(5);
    });

    it('should filter by period', async () => {
      const response = await request(app)
        .get('/api/leaderboard?period=weekly')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });
  });

  describe('GET /api/leaderboard/user/:userId', () => {
    it('should get user rank', async () => {
      const response = await request(app)
        .get(`/api/leaderboard/user/${users[0]._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.rank).toHaveProperty('position');
      expect(response.body.data.rank.position).toBe(1);
    });

    it('should handle non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/leaderboard/user/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/leaderboard/categories', () => {
    it('should get leaderboard categories', async () => {
      const response = await request(app)
        .get('/api/leaderboard/categories')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });
  });

  describe('Cache behavior', () => {
    it('should use cache when available', async () => {
      // Первый запрос - создание кэша
      await request(app)
        .get('/api/leaderboard')
        .set('Authorization', `Bearer ${token}`);

      // Мокаем получение из кэша
      const mockLeaderboard = {
        results: users.map(u => ({
          _id: u._id,
          username: u.username,
          score: u.score
        }))
      };
      jest.spyOn(cacheService, 'getLeaderboardCache').mockResolvedValueOnce(mockLeaderboard);

      const response = await request(app)
        .get('/api/leaderboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(cacheService.getLeaderboardCache).toHaveBeenCalled();
    });
  });
}); 