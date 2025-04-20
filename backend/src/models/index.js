/**
 * Models index file
 * Export all models from a single file
 */
const User = require('./User');
const Story = require('./Story');
const Leaderboard = require('./Leaderboard');
const GameSession = require('./GameSession');

module.exports = {
  User,
  Story,
  Leaderboard,
  GameSession
}; 