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
      // Ошибка во время запроса
      console.error(`API Error (${method} ${endpoint}):`, error);
      
      // Возвращаем стандартизированный объект ошибки
      return {
        success: false,
        message: error.message || 'Произошла ошибка при выполнении запроса'
      };
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
    return this.fetchData('/game/start', 'POST');
  }
  
  /**
   * Отправка ответа
   * @param {string} gameId - ID игры
   * @param {Object} answerData - данные ответа
   * @returns {Promise<Object>} - результат ответа
   */
  async submitAnswer(gameId, answerData) {
    return this.fetchData(`/game/${gameId}/answer`, 'POST', answerData);
  }
  
  /**
   * Завершение игры
   * @param {string} gameId - ID игры
   * @param {Array} answers - массив ответов
   * @returns {Promise<Object>} - результаты игры
   */
  async finishGame(gameId, answers) {
    return this.fetchData(`/game/${gameId}/finish`, 'POST', { answers });
  }
  
  /**
   * Получение текущей игровой сессии
   * @returns {Promise<Object>} - текущая игровая сессия
   */
  async getCurrentGame() {
    return this.fetchData('/game/current');
  }
  
  /**
   * Прерывание игры пользователем
   * @param {string} gameId - ID игры для прерывания
   * @returns {Promise<Object>} - результат прерывания
   */
  async abandonGame(gameId) {
    return this.fetchData(`/game/${gameId}/abandon`, 'POST');
  }
  
  /**
   * Получение таблицы лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   * @param {number} page - номер страницы
   * @param {number} limit - количество записей на странице
   * @returns {Promise<Object>} - данные таблицы лидеров
   */
  async getLeaderboard(period = 'all-time', page = 1, limit = 10) {
    return this.fetchData(`/leaderboard/${period}?page=${page}&limit=${limit}`);
  }
  
  /**
   * Получение позиции пользователя в таблице лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   * @returns {Promise<Object>} - информация о позиции пользователя
   */
  async getUserPosition(period = 'all-time') {
    return this.fetchData(`/leaderboard/position/${period}`);
  }
  
  /**
   * Получение соседей пользователя в таблице лидеров
   * @param {string} period - период ('daily', 'weekly', 'all-time')
   * @param {number} range - количество соседей сверху и снизу
   * @returns {Promise<Object>} - соседи в таблице лидеров
   */
  async getUserNeighbors(period = 'all-time', range = 2) {
    return this.fetchData(`/leaderboard/neighbors/${period}?range=${range}`);
  }
  
  /**
   * Получение данных для админской панели
   * @returns {Promise<Object>} - данные для админской панели
   */
  async getAdminDashboard() {
    return this.fetchData('/admin/dashboard');
  }
  
  /**
   * Получение списка историй
   * @param {number} page - номер страницы
   * @param {number} limit - количество историй на странице
   * @param {Object} filters - фильтры
   * @returns {Promise<Array>} - список историй
   */
  async getStories(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    }).toString();
    
    return this.fetchData(`/admin/stories?${queryParams}`);
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
   * Получение истории по ID
   * @param {string} id - ID истории
   * @returns {Promise<Object>} - история
   */
  async getStoryById(id) {
    return this.fetchData(`/admin/stories/${id}`);
  }
  
  /**
   * Обновление истории
   * @param {string} id - ID истории
   * @param {Object} storyData - новые данные
   * @returns {Promise<Object>} - обновлённая история
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
   * @param {Object} filters - фильтры
   * @returns {Promise<Array>} - список пользователей
   */
  async getUsers(page = 1, limit = 20, filters = {}) {
    const queryParams = new URLSearchParams({
      page,
      limit,
      ...filters
    }).toString();
    
    return this.fetchData(`/admin/users?${queryParams}`);
  }
  
  /**
   * Получение пользователя по ID
   * @param {string} id - ID пользователя
   * @returns {Promise<Object>} - пользователь
   */
  async getUserById(id) {
    return this.fetchData(`/admin/users/${id}`);
  }
  
  /**
   * Обновление пользователя
   * @param {string} id - ID пользователя
   * @param {Object} userData - новые данные
   * @returns {Promise<Object>} - обновлённый пользователь
   */
  async updateUser(id, userData) {
    return this.fetchData(`/admin/users/${id}`, 'PUT', userData);
  }
  
  /**
   * Получение системной статистики
   * @returns {Promise<Object>} - системная статистика
   */
  async getSystemStats() {
    return this.fetchData('/admin/stats');
  }
}

// Создаём экземпляр сервиса для использования во всём приложении
export const apiService = new ApiService();

export default apiService; 