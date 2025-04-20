const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const redisService = require('../../src/services/redisService');
const { User } = require('../../src/models');

describe('Leaderboard Routes', () => {
  let token;
  let adminToken;
  let user;
  let adminUser;
  let redisGetLeaderboardRangeStub;
  let redisGetLeaderboardSizeStub;

  before(async () => {
    // Создаем тестового пользователя
    user = {
      _id: '60d21b4667d0d8992e610c85',
      telegramId: 12345,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      isAdmin: false
    };
    
    // Создаем тестового админа
    adminUser = {
      _id: '60d21b4667d0d8992e610c86',
      telegramId: 67890,
      username: 'adminuser',
      firstName: 'Admin',
      lastName: 'User',
      isAdmin: true
    };
    
    // Создаем токены авторизации
    token = jwt.sign(
      { telegramId: user.telegramId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    adminToken = jwt.sign(
      { telegramId: adminUser.telegramId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    // Создаем заглушки для Redis
    redisGetLeaderboardRangeStub = sinon.stub(redisService, 'getLeaderboardRange');
    redisGetLeaderboardSizeStub = sinon.stub(redisService, 'getLeaderboardSize');
    
    // Настраиваем заглушки для возврата тестовых данных
    redisGetLeaderboardRangeStub.resolves([
      { id: '60d21b4667d0d8992e610c85', score: 1000 },
      { id: '60d21b4667d0d8992e610c86', score: 800 },
      { id: '60d21b4667d0d8992e610c87', score: 600 }
    ]);
    redisGetLeaderboardSizeStub.resolves(10);
    
    // Заглушка для метода findById
    sinon.stub(User, 'findById').callsFake((id) => {
      if (id === '60d21b4667d0d8992e610c85') {
        return Promise.resolve(user);
      } else if (id === '60d21b4667d0d8992e610c86') {
        return Promise.resolve(adminUser);
      } else if (id === '60d21b4667d0d8992e610c87') {
        return Promise.resolve({
          _id: id,
          username: 'otheruser',
          firstName: 'Other',
          lastName: 'User'
        });
      }
      return Promise.resolve(null);
    });
    
    // Заглушка для метода findOne
    sinon.stub(User, 'findOne').callsFake((query) => {
      if (query.telegramId === user.telegramId) {
        return Promise.resolve(user);
      } else if (query.telegramId === adminUser.telegramId) {
        return Promise.resolve(adminUser);
      }
      return Promise.resolve(null);
    });
  });

  after(() => {
    // Восстанавливаем заглушки
    redisGetLeaderboardRangeStub.restore();
    redisGetLeaderboardSizeStub.restore();
    User.findById.restore();
    User.findOne.restore();
  });

  describe('GET /api/leaderboard/global', () => {
    it('should return global leaderboard data when authenticated', async () => {
      const res = await request(app)
        .get('/api/leaderboard/global')
        .set('Authorization', `Bearer ${token}`);
        
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('leaderboard');
      expect(res.body.leaderboard).to.be.an('array');
      expect(res.body.leaderboard).to.have.lengthOf(3);
      expect(res.body).to.have.property('total', 10);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/leaderboard/global');
      expect(res.status).to.equal(401);
    });
  });

  describe('GET /api/leaderboard/weekly', () => {
    it('should return weekly leaderboard data when authenticated', async () => {
      const res = await request(app)
        .get('/api/leaderboard/weekly')
        .set('Authorization', `Bearer ${token}`);
        
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('leaderboard');
      expect(res.body.leaderboard).to.be.an('array');
    });
  });

  describe('GET /api/leaderboard/daily', () => {
    it('should return daily leaderboard data when authenticated', async () => {
      const res = await request(app)
        .get('/api/leaderboard/daily')
        .set('Authorization', `Bearer ${token}`);
        
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('leaderboard');
      expect(res.body.leaderboard).to.be.an('array');
    });
  });

  describe('Admin Routes', () => {
    describe('GET /api/admin/leaderboards/global', () => {
      it('should return global leaderboard data for admin', async () => {
        const res = await request(app)
          .get('/api/admin/leaderboards/global')
          .set('Authorization', `Bearer ${adminToken}`);
          
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('leaderboard');
      });

      it('should return 403 for non-admin users', async () => {
        const res = await request(app)
          .get('/api/admin/leaderboards/global')
          .set('Authorization', `Bearer ${token}`);
          
        expect(res.status).to.equal(403);
      });
    });

    describe('DELETE /api/admin/leaderboards/reset/daily', () => {
      let redisDeleteKeyStub;
      
      before(() => {
        redisDeleteKeyStub = sinon.stub(redisService, 'deleteKey').resolves(true);
      });
      
      after(() => {
        redisDeleteKeyStub.restore();
      });
      
      it('should reset daily leaderboard for admin', async () => {
        const res = await request(app)
          .delete('/api/admin/leaderboards/reset/daily')
          .set('Authorization', `Bearer ${adminToken}`);
          
        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(redisDeleteKeyStub.calledOnce).to.be.true;
      });

      it('should return 403 for non-admin users', async () => {
        const res = await request(app)
          .delete('/api/admin/leaderboards/reset/daily')
          .set('Authorization', `Bearer ${token}`);
          
        expect(res.status).to.equal(403);
      });
    });
  });
}); 