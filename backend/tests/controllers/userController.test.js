const request = require('supertest');
const app = require('../../src/app');
const { User } = require('../../src/models');
const cacheService = require('../../src/services/cacheService');
const { generateToken } = require('../../src/utils/tokenGenerator');

describe('User Controller', () => {
  let user;
  let token;

  beforeEach(async () => {
    // Создаем тестового пользователя
    user = await User.create({
      telegramId: '123456789',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      score: 100,
      gamesPlayed: 5,
      achievements: []
    });

    token = generateToken(user);
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.username).toBe('testuser');
    });

    it('should handle non-existent user', async () => {
      await User.deleteOne({ _id: user._id });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'newusername',
          firstName: 'New',
          lastName: 'Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.username).toBe('newusername');
    });

    it('should handle duplicate username', async () => {
      await User.create({
        telegramId: '987654321',
        username: 'existinguser'
      });

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'existinguser'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/user/achievements', () => {
    it('should get user achievements', async () => {
      const response = await request(app)
        .get('/api/user/achievements')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('achievements');
      expect(response.body.data).toHaveProperty('progress');
    });

    it('should filter achievements by category', async () => {
      const response = await request(app)
        .get('/api/user/achievements?category=gameplay')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.achievements)).toBe(true);
    });
  });

  describe('GET /api/user/stats', () => {
    it('should get user statistics', async () => {
      const response = await request(app)
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('gamesPlayed');
    });
  });

  describe('POST /api/user/avatar', () => {
    it('should update user avatar', async () => {
      const response = await request(app)
        .post('/api/user/avatar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          photoUrl: 'https://example.com/photo.jpg'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.photoUrl).toBe('https://example.com/photo.jpg');
    });
  });
}); 