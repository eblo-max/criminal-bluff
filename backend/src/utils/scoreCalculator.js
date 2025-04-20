/**
 * Калькулятор очков для игры Criminal Bluff
 * Вычисляет количество очков за ответ на основе правильности, времени ответа и текущей серии
 */

/**
 * Рассчитать количество очков за ответ
 * @param {boolean} isCorrect - Правильный ли ответ
 * @param {number} responseTime - Время ответа в миллисекундах
 * @param {number} streak - Текущая серия правильных ответов
 * @returns {number} - Количество заработанных очков
 */
const calculateScore = (isCorrect, responseTime, streak = 0) => {
  // Если ответ неверный, очки не начисляются
  if (!isCorrect) {
    return 0;
  }

  // Базовое количество очков за правильный ответ
  let points = 100;

  // Бонус за скорость (максимум 100 очков при ответе менее 3 секунд)
  const speedBonus = calculateSpeedBonus(responseTime);
  
  // Бонус за серию правильных ответов (начиная со второго подряд)
  const streakBonus = calculateStreakBonus(streak);

  // Итоговое количество очков
  return Math.round(points + speedBonus + streakBonus);
};

/**
 * Рассчитать бонус за скорость ответа
 * @param {number} responseTime - Время ответа в миллисекундах
 * @returns {number} - Бонус за скорость
 */
const calculateSpeedBonus = (responseTime) => {
  // Если время ответа не передано, бонус не начисляется
  if (!responseTime) {
    return 0;
  }

  // Максимальное время для получения бонуса - 15 секунд
  const maxTime = 15000;
  
  // Минимальное время для максимального бонуса - 3 секунды
  const minTime = 3000;
  
  // Максимальный бонус за скорость
  const maxBonus = 100;

  // Если время ответа больше максимального, бонус не начисляется
  if (responseTime >= maxTime) {
    return 0;
  }

  // Если время ответа меньше минимального, начисляется максимальный бонус
  if (responseTime <= minTime) {
    return maxBonus;
  }

  // Линейное уменьшение бонуса от максимального значения до 0
  // в зависимости от времени ответа
  return Math.round(maxBonus * (1 - (responseTime - minTime) / (maxTime - minTime)));
};

/**
 * Рассчитать бонус за серию правильных ответов
 * @param {number} streak - Текущая серия правильных ответов
 * @returns {number} - Бонус за серию
 */
const calculateStreakBonus = (streak) => {
  // Бонус начисляется начиная со второго правильного ответа подряд
  if (streak <= 1) {
    return 0;
  }

  // Максимальный множитель бонуса (при серии 10+)
  const maxMultiplier = 2.0;
  
  // Линейное увеличение множителя от 1.1 (при серии 2) до maxMultiplier (при серии 10+)
  const multiplier = Math.min(1 + (streak - 1) * 0.1, maxMultiplier);
  
  // Базовый бонус за серию
  const baseBonus = 25;
  
  return Math.round(baseBonus * (multiplier - 1));
};

/**
 * Рассчитать бонус опыта за сложность истории
 * @param {string} difficulty - Сложность истории ('easy', 'medium', 'hard')
 * @returns {number} - Множитель сложности
 */
const getDifficultyMultiplier = (difficulty) => {
  switch (difficulty) {
    case 'easy':
      return 1.0;
    case 'medium':
      return 1.3;
    case 'hard':
      return 1.6;
    default:
      return 1.0;
  }
};

/**
 * Анализ статистики игрока
 * @param {Object} stats - Статистика игрока
 * @returns {Object} - Анализ статистики
 */
const analyzePlayerStats = (stats) => {
  const { gamesPlayed, correctAnswers, bestStreak, averageResponseTime } = stats;
  
  // Если игрок не сыграл ни одной игры, вернуть базовый анализ
  if (!gamesPlayed) {
    return {
      skill: 'Новичок',
      accuracy: 0,
      speedRating: 'Неизвестно',
      streakRating: 'Неизвестно',
      recommendations: ['Сыграйте свою первую игру, чтобы получить анализ статистики.']
    };
  }
  
  // Процент правильных ответов
  const accuracy = correctAnswers / (gamesPlayed * 5) * 100;
  
  // Определение уровня навыка
  let skill = 'Новичок';
  if (gamesPlayed >= 100) {
    if (accuracy >= 80) {
      skill = 'Эксперт';
    } else if (accuracy >= 60) {
      skill = 'Опытный';
    } else {
      skill = 'Продвинутый';
    }
  } else if (gamesPlayed >= 20) {
    if (accuracy >= 70) {
      skill = 'Продвинутый';
    } else {
      skill = 'Любитель';
    }
  }
  
  // Оценка скорости ответов
  let speedRating = 'Средняя';
  if (averageResponseTime) {
    if (averageResponseTime < 5000) {
      speedRating = 'Молниеносная';
    } else if (averageResponseTime < 8000) {
      speedRating = 'Быстрая';
    } else if (averageResponseTime > 12000) {
      speedRating = 'Медленная';
    }
  }
  
  // Оценка серий
  let streakRating = 'Нормальная';
  if (bestStreak >= 10) {
    streakRating = 'Впечатляющая';
  } else if (bestStreak >= 5) {
    streakRating = 'Хорошая';
  } else if (bestStreak <= 2) {
    streakRating = 'Нужно улучшать';
  }
  
  // Рекомендации
  const recommendations = [];
  
  if (accuracy < 50) {
    recommendations.push('Постарайтесь внимательнее читать истории и обдумывать свои ответы.');
  }
  
  if (averageResponseTime && averageResponseTime > 10000) {
    recommendations.push('Попробуйте отвечать быстрее для получения бонусов за скорость.');
  }
  
  if (bestStreak < 3) {
    recommendations.push('Стремитесь к сериям правильных ответов для получения бонусов.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Вы показываете хорошие результаты! Продолжайте в том же духе.');
  }
  
  return {
    skill,
    accuracy: Math.round(accuracy),
    speedRating,
    streakRating,
    recommendations
  };
};

module.exports = {
  calculateScore,
  calculateSpeedBonus,
  calculateStreakBonus,
  getDifficultyMultiplier,
  analyzePlayerStats
}; 