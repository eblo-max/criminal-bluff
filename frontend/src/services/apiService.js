/**
 * API Service
 * Сервис для взаимодействия с бэкэндом
 */
export class ApiService {
  constructor() {
    // Базовый URL API
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? '/api' 
      : 'http://localhost:3000/api';
    
    // Токен для авторизации
    this.token = localStorage.getItem('auth_token');
  }
  
  /**
   * Общий метод для выполнения HTTP запросов
   * @param {string} endpoint - конечная точка API
   * @param {string} method - HTTP метод
   * @param {Object} data - данные для отправки
   * @returns {Promise<any>} - результат запроса
   */
  async fetchData(endpoint, method = 'GET', data = null) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      };
      
      // Добавляем токен, если он есть
      if (this.token) {
        options.headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      // Добавляем данные Telegram, если нет токена
      if (!this.token && window.Telegram?.WebApp?.initData) {
        if (method === 'GET') {
          options.headers['Telegram-Data'] = window.Telegram.WebApp.initData;
        } else {
          data = { ...data, initData: window.Telegram.WebApp.initData };
        }
      }
      
      // Добавляем тело запроса для не-GET методов
      if (method !== 'GET' && data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      
      // Сохраняем токен из заголовка, если он есть
      const authToken = response.headers.get('X-Auth-Token');
      if (authToken) {
        this.token = authToken;
        localStorage.setItem('auth_token', authToken);
      }
      
      // Проверяем статус ответа
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при обращении к API');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
  
  /**
   * Создание или обновление профиля пользователя
   * @param {Object} userData - данные пользователя из Telegram
   * @returns {Promise<Object>} - созданный/обновленный профиль
   */
  async createOrUpdateUser(userData) {
    return this.fetchData('/user/create', 'POST', userData);
  }
  
  /**
   * Получение профиля пользователя
   * @returns {Promise<Object>} - профиль пользователя
   */
  async getUserProfile() {
    return this.fetchData('/user/profile');
  }
  
  /**
   * Получение достижений пользователя
   * @returns {Promise<Array>} - массив достижений
   */
  async getUserAchievements() {
    return this.fetchData('/user/achievements');
  }
  
  /**
   * Получение статистики пользователя
   * @returns {Promise<Object>} - статистика пользователя
   */
  async getUserStats() {
    return this.fetchData('/user/stats');
  }
  
  /**
   * Начало новой игры
   * @returns {Promise<Object>} - данные игровой сессии
   */
  async startGame() {
    return this.fetchData('/game/start');
  }
  
  /**
   * Отправка ответа
   * @param {Object} answerData - данные ответа
   * @returns {Promise<Object>} - результат ответа
   */
  async submitAnswer(answerData) {
    return this.fetchData('/game/answer', 'POST', answerData);
  }
  
  /**
   * Завершение игры
   * @param {Object} gameData - данные завершённой игры
   * @returns {Promise<Object>} - результаты игры
   */
  async finishGame(gameData) {
    return this.fetchData('/game/finish', 'POST', gameData);
  }
  
  /**
   * Получение текущей игровой сессии
   * @returns {Promise<Object>} - текущая игровая сессия
   */
  async getCurrentGame() {
    return this.fetchData('/game/current');
  }
  
  /**
   * Получение таблицы лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   * @returns {Promise<Array>} - данные таблицы лидеров
   */
  async getLeaderboard(period = 'daily') {
    return this.fetchData(`/leaderboard/${period}`);
  }
  
  /**
   * Получение позиции пользователя в таблице лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   * @returns {Promise<number>} - позиция пользователя
   */
  async getUserPosition(period = 'all-time') {
    return this.fetchData('/leaderboard/user-position', 'GET', { period });
  }
  
  /**
   * Получение соседей пользователя в рейтинге
   * @param {number} range - количество соседей сверху и снизу (по умолчанию 5)
   * @returns {Promise<Object>} - список соседей и позиция пользователя
   */
  async getUserNeighbors(range = 5) {
    return this.fetchData(`/leaderboard/user-neighbors?range=${range}`);
  }

  /**
   * Методы для административной панели
   */

  /**
   * Получение данных для дашборда администратора
   * @returns {Promise<Object>} - данные дашборда
   */
  async getAdminDashboard() {
    return this.fetchData('/admin/dashboard');
  }
  
  /**
   * Получение списка историй
   * @param {number} page - номер страницы
   * @param {number} limit - количество историй на странице
   * @param {Object} filters - фильтры (difficulty, category, search)
   * @returns {Promise<Object>} - список историй и пагинация
   */
  async getStories(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    });
    
    return this.fetchData(`/admin/stories?${queryParams.toString()}`);
  }
  
  /**
   * Создание новой истории
   * @param {Object} storyData - данные истории
   * @returns {Promise<Object>} - созданная история
   */
  async createStory(storyData) {
    return this.fetchData('/admin/stories', 'POST', storyData);
  }
  
  /**
   * Получение информации об истории
   * @param {string} id - ID истории
   * @returns {Promise<Object>} - информация об истории
   */
  async getStoryById(id) {
    return this.fetchData(`/admin/stories/${id}`);
  }
  
  /**
   * Обновление истории
   * @param {string} id - ID истории
   * @param {Object} storyData - новые данные истории
   * @returns {Promise<Object>} - обновленная история
   */
  async updateStory(id, storyData) {
    return this.fetchData(`/admin/stories/${id}`, 'PUT', storyData);
  }
  
  /**
   * Удаление истории
   * @param {string} id - ID истории
   * @returns {Promise<Object>} - результат удаления
   */
  async deleteStory(id) {
    return this.fetchData(`/admin/stories/${id}`, 'DELETE');
  }
  
  /**
   * Получение списка пользователей
   * @param {number} page - номер страницы
   * @param {number} limit - количество пользователей на странице
   * @param {Object} filters - фильтры (search)
   * @returns {Promise<Object>} - список пользователей и пагинация
   */
  async getUsers(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    });
    
    return this.fetchData(`/admin/users?${queryParams.toString()}`);
  }
  
  /**
   * Получение информации о пользователе
   * @param {string} id - ID пользователя
   * @returns {Promise<Object>} - информация о пользователе
   */
  async getUserById(id) {
    return this.fetchData(`/admin/users/${id}`);
  }
  
  /**
   * Обновление пользователя
   * @param {string} id - ID пользователя
   * @param {Object} userData - новые данные пользователя
   * @returns {Promise<Object>} - обновленный пользователь
   */
  async updateUser(id, userData) {
    return this.fetchData(`/admin/users/${id}`, 'PUT', userData);
  }
  
  /**
   * Получение общей статистики системы
   * @returns {Promise<Object>} - общая статистика
   */
  async getSystemStats() {
    return this.fetchData('/admin/stats');
  }
} 