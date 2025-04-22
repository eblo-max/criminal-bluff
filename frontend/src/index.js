import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import './index.css';
import { sentryService } from './services/sentryService';
import { sharedState } from './services/common';

// Глобальные обработчики ошибок
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Глобальная ошибка:', message, error);
  sharedState.showErrorMessage(`Произошла ошибка: ${message}`);
  
  // Также отправляем ошибку в логирование
  sentryService.captureException(error || new Error(message));
  
  return true; // предотвращаем дальнейшую обработку ошибки
};

// Обработчик необработанных Promise rejection
window.addEventListener('unhandledrejection', function(event) {
  console.error('Необработанный промис:', event.reason);
  sharedState.showErrorMessage(`Необработанная ошибка промиса: ${event.reason?.message || 'Неизвестная ошибка'}`);
  
  // Также отправляем ошибку в логирование
  sentryService.captureException(event.reason || new Error('Unhandled promise rejection'));
});

// Создаем загрузочный экран до инициализации React
function createLoadingScreen() {
  try {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '0';
    loadingScreen.style.left = '0';
    loadingScreen.style.width = '100%';
    loadingScreen.style.height = '100%';
    loadingScreen.style.background = 'rgba(255, 255, 255, 0.8)';
    loadingScreen.style.display = 'flex';
    loadingScreen.style.justifyContent = 'center';
    loadingScreen.style.alignItems = 'center';
    loadingScreen.style.zIndex = '9999';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Загрузка приложения...';
    loadingText.style.fontSize = '18px';
    loadingText.style.color = '#333';
    
    // Также добавляем контейнер для отладочных сообщений
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debug-log';
    debugContainer.style.position = 'fixed';
    debugContainer.style.bottom = '10px';
    debugContainer.style.right = '10px';
    debugContainer.style.width = '300px';
    debugContainer.style.maxHeight = '200px';
    debugContainer.style.overflow = 'auto';
    debugContainer.style.background = 'rgba(0,0,0,0.7)';
    debugContainer.style.color = 'white';
    debugContainer.style.padding = '10px';
    debugContainer.style.borderRadius = '5px';
    debugContainer.style.fontSize = '12px';
    debugContainer.style.fontFamily = 'monospace';
    debugContainer.style.zIndex = '10000';
    
    if (process.env.NODE_ENV === 'development' || window.location.search.includes('debug=true')) {
      window.debugMode = true;
      debugContainer.style.display = 'block';
    } else {
      debugContainer.style.display = 'none';
    }
    
    loadingScreen.appendChild(loadingText);
    document.body.appendChild(loadingScreen);
    document.body.appendChild(debugContainer);
    
    sharedState.log('Загрузочный экран создан');
  } catch (error) {
    console.error('Не удалось создать загрузочный экран:', error);
  }
}

// Безопасный рендеринг React-приложения
function safeRenderApp() {
  try {
    sharedState.log('Попытка рендеринга React-приложения');
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('DOM-элемент с id="root" не найден!');
    }
    
    const root = createRoot(rootElement);
    root.render(
      <App />
    );
    
    // Убираем загрузочный экран после успешного рендеринга
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s';
        setTimeout(() => {
          if (loadingScreen.parentNode) {
            loadingScreen.parentNode.removeChild(loadingScreen);
          }
        }, 500);
      }, 300);
    }
    
    sharedState.log('React-приложение успешно отрендерено');
  } catch (error) {
    console.error('Ошибка при рендеринге React-приложения:', error);
    sharedState.showErrorMessage(`Не удалось запустить приложение: ${error.message}`);
    sentryService.captureException(error);
  }
}

// Главная функция инициализации приложения
function initializeApp() {
  try {
    sharedState.log('Начало инициализации приложения');
    
    // Создаем загрузочный экран
    createLoadingScreen();
    
    // Проверяем доступность Telegram WebApp API
    if (window.Telegram && window.Telegram.WebApp) {
      sharedState.log('Telegram WebApp API доступен');
      
      // Сообщаем Telegram, что приложение готово
      window.Telegram.WebApp.ready();
      
      // Регистрируем обработчик события изменения области просмотра
      window.Telegram.WebApp.onEvent('viewportChanged', () => {
        sharedState.log('Событие viewportChanged получено');
        
        if (!sharedState.isInitialized) {
          sharedState.log('Приложение еще не инициализировано, запускаем инициализацию');
          sharedState.isTelegramReady = true;
          
          // Задержка для гарантии, что DOM полностью загружен
          setTimeout(() => {
            safeRenderApp();
            sharedState.isInitialized = true;
          }, 200);
        }
      });
      
      // Запускаем таймер, который инициализирует приложение, если событие viewportChanged не пришло
      setTimeout(() => {
        if (!sharedState.isInitialized) {
          sharedState.log('Таймаут ожидания viewportChanged, инициализируем приложение принудительно');
          sharedState.isTelegramReady = true;
          safeRenderApp();
          sharedState.isInitialized = true;
        }
      }, 1000);
    } else {
      sharedState.log('Telegram WebApp API не доступен, инициализируем в режиме разработки', 'warn');
      
      // В режиме разработки или при открытии вне Telegram
      setTimeout(() => {
        // Создаем некоторые мок-данные для разработки
        window.Telegram = window.Telegram || {};
        window.Telegram.WebApp = window.Telegram.WebApp || {
          ready: () => console.log('Mock: Telegram.WebApp.ready() called'),
          expand: () => console.log('Mock: Telegram.WebApp.expand() called'),
          MainButton: {
            show: () => console.log('Mock: MainButton.show() called'),
            hide: () => console.log('Mock: MainButton.hide() called'),
            setText: (text) => console.log(`Mock: MainButton.setText("${text}") called`)
          },
          onEvent: (eventName, callback) => {
            console.log(`Mock: Registered handler for "${eventName}" event`);
            if (eventName === 'viewportChanged' && callback) {
              setTimeout(callback, 100);
            }
          },
          initData: 'mock_init_data',
          initDataUnsafe: {
            user: {
              id: 123456789,
              first_name: 'Тестовый',
              last_name: 'Пользователь',
              username: 'test_user'
            }
          }
        };
        
        sharedState.isTelegramReady = true;
        safeRenderApp();
        sharedState.isInitialized = true;
      }, 500);
    }
  } catch (error) {
    console.error('Критическая ошибка при инициализации приложения:', error);
    sharedState.showErrorMessage(`Критическая ошибка при инициализации: ${error.message}`);
    sentryService.captureException(error);
  }
}

// Запускаем инициализацию приложения после полной загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM уже загружен, инициализируем немедленно
  initializeApp();
}

// Добавляем инициализацию перед загрузкой основного JS файла
(function() {
  // Функция для создания элемента сообщения об ошибке
  function createErrorMessage() {
    // Проверяем, существует ли уже элемент ошибки
    if (document.getElementById('error-message')) {
      return;
    }
    
    // Создаем элемент для отображения сообщений об ошибках
    const errorElement = document.createElement('div');
    errorElement.id = 'error-message';
    errorElement.style.display = 'none';
    errorElement.style.position = 'fixed';
    errorElement.style.top = '50%';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translate(-50%, -50%)';
    errorElement.style.backgroundColor = '#f5222d';
    errorElement.style.color = 'white';
    errorElement.style.padding = '15px 20px';
    errorElement.style.borderRadius = '8px';
    errorElement.style.maxWidth = '80%';
    errorElement.style.textAlign = 'center';
    errorElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    errorElement.style.zIndex = '10000';
    errorElement.style.fontFamily = 'Arial, sans-serif';
    
    document.body.appendChild(errorElement);
  }
  
  // Создаем элемент для загрузки
  function createLoadingIndicator() {
    // Проверяем, существует ли уже индикатор загрузки
    if (document.getElementById('loading-screen')) {
      return;
    }
    
    // Создаем элемент экрана загрузки
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '0';
    loadingScreen.style.left = '0';
    loadingScreen.style.width = '100%';
    loadingScreen.style.height = '100%';
    loadingScreen.style.backgroundColor = '#1b1b1b';
    loadingScreen.style.display = 'flex';
    loadingScreen.style.flexDirection = 'column';
    loadingScreen.style.alignItems = 'center';
    loadingScreen.style.justContent = 'center';
    loadingScreen.style.zIndex = '9999';
    
    // Создаем анимацию загрузки
    const spinner = document.createElement('div');
    spinner.style.width = '50px';
    spinner.style.height = '50px';
    spinner.style.borderRadius = '50%';
    spinner.style.border = '5px solid rgba(255, 255, 255, 0.1)';
    spinner.style.borderTopColor = '#ff4d4f';
    spinner.style.animation = 'spin 1s linear infinite';
    
    // Добавляем стиль анимации
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    // Текст загрузки
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Загрузка...';
    loadingText.style.color = '#fff';
    loadingText.style.marginTop = '20px';
    loadingText.style.fontFamily = 'Arial, sans-serif';
    
    loadingScreen.appendChild(spinner);
    loadingScreen.appendChild(loadingText);
    document.body.appendChild(loadingScreen);
  }
  
  // Глобальный обработчик необработанных ошибок
  window.onerror = function(message, source, lineno, colno, error) {
    console.error('Необработанная ошибка:', message, error);
    
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = 'Ошибка при запуске приложения. Пожалуйста, попробуйте позже.';
      errorElement.style.display = 'block';
      
      // Скрываем экран загрузки, если он показан
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }
    
    // Используем сервис логирования, если он доступен
    if (window.sentryService) {
      window.sentryService.captureException(error || new Error(message));
    }
    
    return false; // Позволяет выполнить стандартную обработку ошибок браузера
  };
  
  // Глобальный обработчик необработанных Promise rejection
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Необработанное отклонение Promise:', event.reason);
    
    const errorElement = document.getElementById('error-message');
    if (errorElement && !errorElement.style.display === 'block') {
      errorElement.textContent = 'Ошибка при запуске приложения. Пожалуйста, попробуйте позже.';
      errorElement.style.display = 'block';
      
      // Скрываем экран загрузки, если он показан
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.display = 'none';
      }
    }
    
    // Используем сервис логирования, если он доступен
    if (window.sentryService) {
      window.sentryService.captureException(event.reason);
    }
  });
  
  // Создаем элементы UI для обработки ошибок и загрузки
  createErrorMessage();
  createLoadingIndicator();
  
  // Устанавливаем таймаут для автоматического скрытия загрузки 
  // на случай, если основное приложение не загрузится
  setTimeout(function() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && loadingScreen.style.display !== 'none') {
      loadingScreen.style.display = 'none';
      
      const errorElement = document.getElementById('error-message');
      if (errorElement) {
        errorElement.textContent = 'Превышено время ожидания загрузки. Пожалуйста, обновите страницу.';
        errorElement.style.display = 'block';
      }
    }
  }, 15000); // 15 секунд таймаут
})(); 