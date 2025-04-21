import axios from 'axios';
import errorService from './errorService';

// Создаем инстанс axios с базовым URL
const http = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Интерцептор запросов
http.interceptors.request.use(
  config => {
    // Добавляем токен авторизации, если он есть
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Добавляем параметры телеграм инициации если они есть
    const initData = localStorage.getItem('tg_init_data');
    if (initData) {
      config.headers['X-Telegram-Init-Data'] = initData;
    }
    
    return config;
  },
  error => {
    // Отправляем ошибку в систему мониторинга
    errorService.captureException(error, {
      tags: { component: 'httpService', type: 'request' }
    });
    return Promise.reject(error);
  }
);

// Интерцептор ответов
http.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Отправляем информацию об ошибке в систему мониторинга
    const errorData = {
      tags: { 
        component: 'httpService', 
        type: 'response'
      },
      extra: {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status
      }
    };
    
    // Игнорируем ошибки авторизации в системе мониторинга
    if (error.response?.status !== 401) {
      errorService.captureException(error, errorData);
    }
    
    // Если ошибка связана с токеном (401), можно обновить токен или перенаправить на страницу логина
    if (error.response && error.response.status === 401) {
      // Здесь может быть логика обновления токена или редиректа
      console.log('Unauthorized - token expired or invalid');
    }
    
    return Promise.reject(error);
  }
);

// Сервис для работы с HTTP запросами
const httpService = {
  /**
   * Выполняет GET запрос
   * @param {string} url - URL для запроса
   * @param {object} params - Параметры запроса
   * @param {object} options - Дополнительные опции для axios
   * @returns {Promise} - Promise с результатом запроса
   */
  get: (url, params = {}, options = {}) => {
    return http.get(url, { params, ...options });
  },
  
  /**
   * Выполняет POST запрос
   * @param {string} url - URL для запроса
   * @param {object} data - Данные для отправки
   * @param {object} options - Дополнительные опции для axios
   * @returns {Promise} - Promise с результатом запроса
   */
  post: (url, data = {}, options = {}) => {
    return http.post(url, data, options);
  },
  
  /**
   * Выполняет PUT запрос
   * @param {string} url - URL для запроса
   * @param {object} data - Данные для отправки
   * @param {object} options - Дополнительные опции для axios
   * @returns {Promise} - Promise с результатом запроса
   */
  put: (url, data = {}, options = {}) => {
    return http.put(url, data, options);
  },
  
  /**
   * Выполняет PATCH запрос
   * @param {string} url - URL для запроса
   * @param {object} data - Данные для отправки
   * @param {object} options - Дополнительные опции для axios
   * @returns {Promise} - Promise с результатом запроса
   */
  patch: (url, data = {}, options = {}) => {
    return http.patch(url, data, options);
  },
  
  /**
   * Выполняет DELETE запрос
   * @param {string} url - URL для запроса
   * @param {object} options - Дополнительные опции для axios
   * @returns {Promise} - Promise с результатом запроса
   */
  delete: (url, options = {}) => {
    return http.delete(url, options);
  }
};

export default httpService; 