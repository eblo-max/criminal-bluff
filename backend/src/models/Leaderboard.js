/**
 * Leaderboard model for MongoDB
 * Represents leaderboard entries for different time periods
 */
const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  telegramId: {
    type: Number,
    required: [true, 'Telegram ID is required']
  },
  username: {
    type: String,
    trim: true
  },
  score: {
    type: Number,
    required: [true, 'Score is required'],
    default: 0
  },
  period: {
    type: String,
    required: [true, 'Period is required'],
    enum: {
      values: ['daily', 'weekly', 'all-time'],
      message: 'Period must be daily, weekly, or all-time'
    }
  },
  periodDate: {
    type: Date,
    required: [true, 'Period date is required']
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient leaderboard queries
LeaderboardSchema.index({ period: 1, periodDate: 1, score: -1 });
LeaderboardSchema.index({ telegramId: 1, period: 1, periodDate: 1 }, { unique: true });

module.exports = mongoose.model('Leaderboard', LeaderboardSchema); 