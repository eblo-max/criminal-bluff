/**
 * Story model for MongoDB
 * Represents a criminal story with options for the game
 */
const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, 'Story text is required'],
    trim: true,
    maxlength: [500, 'Story text cannot exceed 500 characters']
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function(options) {
        return options.length === 3;
      },
      message: 'Story must have exactly 3 options'
    }
  },
  correctAnswer: {
    type: Number,
    required: [true, 'Correct answer index is required'],
    min: [0, 'Correct answer index must be 0, 1, or 2'],
    max: [2, 'Correct answer index must be 0, 1, or 2']
  },
  explanation: {
    type: String,
    required: [true, 'Explanation is required'],
    trim: true,
    maxlength: [1000, 'Explanation cannot exceed 1000 characters']
  },
  difficulty: {
    type: String,
    required: [true, 'Difficulty is required'],
    enum: {
      values: ['easy', 'medium', 'hard'],
      message: 'Difficulty must be easy, medium, or hard'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
StorySchema.index({ difficulty: 1, category: 1, active: 1 });

module.exports = mongoose.model('Story', StorySchema); 