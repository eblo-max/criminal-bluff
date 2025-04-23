const { body } = require('express-validator');

const gameValidation = {
  submitAnswer: [
    body('storyId').notEmpty().withMessage('ID истории обязателен'),
    body('selectedAnswer').notEmpty().withMessage('Выбранный ответ обязателен'),
    body('timeSpent').isInt({ min: 0 }).withMessage('Время ответа должно быть положительным числом')
  ]
};

const userValidation = {
  updateProfile: [
    body('username').optional().isLength({ min: 3 }).withMessage('Имя пользователя должно быть не менее 3 символов'),
    body('avatar').optional().isURL().withMessage('Некорректный URL аватара')
  ]
};

const adminValidation = {
  addStory: [
    body('text').notEmpty().withMessage('Текст истории обязателен'),
    body('options').isArray({ min: 2 }).withMessage('Минимум 2 варианта ответа'),
    body('correctAnswer').isInt({ min: 0 }).withMessage('Правильный ответ обязателен'),
    body('category').notEmpty().withMessage('Категория обязательна'),
    body('difficulty').isInt({ min: 1, max: 5 }).withMessage('Сложность должна быть от 1 до 5')
  ]
};

module.exports = {
  gameValidation,
  userValidation,
  adminValidation
}; 