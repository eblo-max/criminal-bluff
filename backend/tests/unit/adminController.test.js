const { expect } = require('chai');
const sinon = require('sinon');
const adminController = require('../../src/controllers/adminController');
const redisService = require('../../src/services/redisService');
const leaderboardService = require('../../src/services/leaderboardService');
const { User, Game } = require('../../src/models');
const logger = require('../../src/utils/logger');

describe('Admin Controller', () => {
  describe('resetLeaderboard', () => {
    let req;
    let res;
    let redisDeleteKeyStub;
    let userUpdateManyStub;
    let loggerInfoStub;
    let getWeekNumberStub;

    beforeEach(() => {
      // Создаем имитации запроса и ответа
      req = {
        params: { type: 'daily' },
        user: { _id: 'admin123' }
      };
      
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      };

      // Создаем заглушки для методов Redis
      redisDeleteKeyStub = sinon.stub(redisService, 'deleteKey').resolves(true);
      userUpdateManyStub = sinon.stub(User, 'updateMany').resolves({ modifiedCount: 10 });
      loggerInfoStub = sinon.stub(logger, 'info');
      getWeekNumberStub = sinon.stub(leaderboardService, 'getWeekNumber').returns(1);
    });

    afterEach(() => {
      // Восстанавливаем оригинальные методы
      redisDeleteKeyStub.restore();
      userUpdateManyStub.restore();
      loggerInfoStub.restore();
      getWeekNumberStub.restore();
    });

    it('should reset daily leaderboard correctly', async () => {
      await adminController.resetLeaderboard(req, res);
      
      expect(redisDeleteKeyStub.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
    });

    it('should reset weekly leaderboard correctly', async () => {
      req.params.type = 'weekly';
      
      await adminController.resetLeaderboard(req, res);
      
      expect(redisDeleteKeyStub.calledOnce).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
    });

    it('should reset global leaderboard and update user scores', async () => {
      req.params.type = 'global';
      
      await adminController.resetLeaderboard(req, res);
      
      expect(redisDeleteKeyStub.calledOnce).to.be.true;
      expect(userUpdateManyStub.calledOnce).to.be.true;
      expect(userUpdateManyStub.firstCall.args[1]).to.deep.equal({ totalScore: 0 });
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
    });

    it('should handle invalid leaderboard type', async () => {
      req.params.type = 'invalid';
      
      await adminController.resetLeaderboard(req, res);
      
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.false;
    });

    it('should handle case when leaderboard does not exist', async () => {
      redisDeleteKeyStub.resolves(false);
      
      await adminController.resetLeaderboard(req, res);
      
      expect(res.status.calledWith(404)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.false;
    });
  });

  describe('rebuildLeaderboards', () => {
    let req;
    let res;
    let redisGetKeysByPatternStub;
    let redisDeleteKeyStub;
    let userUpdateManyStub;
    let gameFindStub;
    let userFindByIdAndUpdateStub;
    let redisAddToSortedSetStub;
    let redisGetScoreStub;
    let redisSetValueStub;
    let loggerInfoStub;

    beforeEach(() => {
      // Создаем имитации запроса и ответа
      req = {};
      
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      };

      // Создаем заглушки для методов
      redisGetKeysByPatternStub = sinon.stub(redisService, 'getKeysByPattern');
      redisGetKeysByPatternStub.withArgs('leaderboard:*').resolves(['key1', 'key2']);
      redisGetKeysByPatternStub.withArgs('leaderboard:daily:*').resolves(['daily1', 'daily2']);
      redisGetKeysByPatternStub.withArgs('leaderboard:weekly:*').resolves(['weekly1', 'weekly2']);
      
      redisDeleteKeyStub = sinon.stub(redisService, 'deleteKey').resolves(true);
      userUpdateManyStub = sinon.stub(User, 'updateMany').resolves({});
      
      // Создаем тестовые данные для игр
      const testGames = [
        { userId: 'user1', score: 100, completedAt: new Date() },
        { userId: 'user1', score: 200, completedAt: new Date() },
        { userId: 'user2', score: 150, completedAt: new Date() }
      ];
      gameFindStub = sinon.stub(Game, 'find').returns({
        sort: sinon.stub().returnsThis(),
        select: sinon.stub().resolves(testGames)
      });
      
      userFindByIdAndUpdateStub = sinon.stub(User, 'findByIdAndUpdate').resolves({});
      redisAddToSortedSetStub = sinon.stub(redisService, 'addToSortedSet').resolves();
      redisGetScoreStub = sinon.stub(redisService, 'getScore').resolves(0);
      redisSetValueStub = sinon.stub(redisService, 'setValue').resolves();
      loggerInfoStub = sinon.stub(logger, 'info');
    });

    afterEach(() => {
      // Восстанавливаем оригинальные методы
      redisGetKeysByPatternStub.restore();
      redisDeleteKeyStub.restore();
      userUpdateManyStub.restore();
      gameFindStub.restore();
      userFindByIdAndUpdateStub.restore();
      redisAddToSortedSetStub.restore();
      redisGetScoreStub.restore();
      redisSetValueStub.restore();
      loggerInfoStub.restore();
    });

    it('should rebuild leaderboards correctly', async () => {
      await adminController.rebuildLeaderboards(req, res);
      
      expect(redisGetKeysByPatternStub.calledWith('leaderboard:*')).to.be.true;
      expect(redisDeleteKeyStub.called).to.be.true;
      expect(userUpdateManyStub.calledWith({}, { totalScore: 0 })).to.be.true;
      expect(gameFindStub.called).to.be.true;
      expect(userFindByIdAndUpdateStub.called).to.be.true;
      expect(redisAddToSortedSetStub.called).to.be.true;
      expect(redisSetValueStub.called).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0].success).to.be.true;
    });

    it('should handle case with no games', async () => {
      gameFindStub.returns({
        sort: sinon.stub().returnsThis(),
        select: sinon.stub().resolves([])
      });
      
      await adminController.rebuildLeaderboards(req, res);
      
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.firstCall.args[0].message).to.include('No games found');
    });
  });
}); 