import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import './index.css';
import { sharedState } from './services/common';

// Глобальные обработчики ошибок
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Глобальная ошибка:', message, error);
  sharedState.showErrorMessage(`Произошла ошибка: ${message}`);
  
  return true; // предотвращаем дальнейшую обработку ошибки
};

// Обработчик необработанных Promise rejection
window.addEventListener('unhandledrejection', function(event) {
  console.error('Необработанный промис:', event.reason);
  sharedState.showErrorMessage(`Необработанная ошибка промиса: ${event.reason?.message || 'Неизвестная ошибка'}`);
});

// Создаем загрузочный экран до инициализации React
function createLoadingScreen() {
  try {
    // Проверяем, существует ли уже загрузочный экран
    if (document.getElementById('loading-screen')) {
      return;
    }
    
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.position = 'fixed';
    loadingScreen.style.top = '0';
    loadingScreen.style.left = '0';
    loadingScreen.style.width = '100%';
    loadingScreen.style.height = '100%';
    loadingScreen.style.background = 'rgba(20, 20, 20, 0.9)';
    loadingScreen.style.display = 'flex';
    loadingScreen.style.flexDirection = 'column';
    loadingScreen.style.justifyContent = 'center';
    loadingScreen.style.alignItems = 'center';
    loadingScreen.style.zIndex = '9999';
    
    const loadingText = document.createElement('div');
    loadingText.textContent = 'Загрузка приложения...';
    loadingText.style.fontSize = '18px';
    loadingText.style.color = '#fff';
    loadingText.style.marginBottom = '20px';
    
    // Создаем анимированный спиннер
    const spinner = document.createElement('div');
    spinner.style.width = '40px';
    spinner.style.height = '40px';
    spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
    spinner.style.borderTop = '4px solid #fff';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'spin 1s linear infinite';
    
    // Добавляем стиль анимации
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    // Также добавляем контейнер для отладочных сообщений
    const debugContainer = document.createElement('div');
    debugContainer.id = 'debug-log';
    debugContainer.style.position = 'fixed';
    debugContainer.style.bottom = '10px';
    debugContainer.style.left = '10px';
    debugContainer.style.width = '300px';
    debugContainer.style.maxHeight = '150px';
    debugContainer.style.overflow = 'auto';
    debugContainer.style.background = 'rgba(0,0,0,0.7)';
    debugContainer.style.color = '#4caf50';
    debugContainer.style.padding = '10px';
    debugContainer.style.borderRadius = '5px';
    debugContainer.style.fontSize = '12px';
    debugContainer.style.fontFamily = 'monospace';
    debugContainer.style.zIndex = '10000';
    
    // Версия и информация о платформе
    const versionInfo = document.createElement('div');
    versionInfo.id = 'version-info';
    versionInfo.style.position = 'fixed';
    versionInfo.style.bottom = '10px';
    versionInfo.style.right = '10px';
    versionInfo.style.fontSize = '12px';
    versionInfo.style.color = '#4caf50';
    versionInfo.style.zIndex = '10000';
    versionInfo.style.textAlign = 'right';
    
    // Добавляем информацию о версии и платформе
    let infoText = '';
    infoText += `• Версия: ${window.appVersion || '1.0.0'}\n`;
    infoText += `• Платформа: ${window.Telegram?.WebApp?.platform || 'desktop'}\n`;
    infoText += `• Viewport высота: ${window.Telegram?.WebApp?.viewportHeight || window.innerHeight}px\n`;
    infoText += `• InitData: ${window.Telegram?.WebApp?.initData?.substring(0, 30) || 'недоступны'}...\n`;
    versionInfo.innerHTML = infoText.replace(/\n/g, '<br>• ');
    
    if (process.env.NODE_ENV === 'development' || window.location.search.includes('debug=true')) {
      window.debugMode = true;
      debugContainer.style.display = 'block';
      versionInfo.style.display = 'block';
    } else {
      debugContainer.style.display = 'none';
      versionInfo.style.display = 'none';
    }
    
    // Добавляем элемент для отображения ошибок
    const errorContainer = document.createElement('div');
    errorContainer.id = 'loading-errors';
    errorContainer.style.marginTop = '20px';
    errorContainer.style.color = '#f44336';
    errorContainer.style.fontSize = '14px';
    errorContainer.style.textAlign = 'center';
    errorContainer.style.maxWidth = '80%';
    
    loadingScreen.appendChild(spinner);
    loadingScreen.appendChild(loadingText);
    loadingScreen.appendChild(errorContainer);
    document.body.appendChild(loadingScreen);
    document.body.appendChild(debugContainer);
    document.body.appendChild(versionInfo);
    
    sharedState.log('Загрузочный экран создан');
  } catch (error) {
    console.error('Не удалось создать загрузочный экран:', error);
  }
}

// Функция для добавления ошибки на загрузочный экран
function addLoadingError(message) {
  try {
    const errorContainer = document.getElementById('loading-errors');
    if (errorContainer) {
      const errorItem = document.createElement('div');
      errorItem.textContent = `Ошибки (${errorContainer.children.length + 1}): ${message}`;
      errorItem.style.marginBottom = '5px';
      errorContainer.appendChild(errorItem);
    }
  } catch (e) {
    console.error('Ошибка при добавлении сообщения об ошибке:', e);
  }
}

// Безопасный рендеринг React-приложения
function safeRenderApp() {
  try {
    sharedState.log('Попытка рендеринга React-приложения');
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      const error = new Error('DOM-элемент с id="root" не найден!');
      addLoadingError(error.message);
      throw error;
    }
    
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Убираем загрузочный экран после успешного рендеринга
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s';
        setTimeout(() => {
          if (loadingScreen && loadingScreen.parentNode) {
            loadingScreen.parentNode.removeChild(loadingScreen);
          }
        }, 500);
      }, 300);
    }
    
    sharedState.log('React-приложение успешно отрендерено');
  } catch (error) {
    console.error('Ошибка при рендеринге React-приложения:', error);
    addLoadingError(error.message);
    sharedState.showErrorMessage(`Не удалось запустить приложение: ${error.message}`);
  }
}

// Функция проверки на тестовую среду
function isTestEnvironment() {
  return window.location.host.includes('localhost') || 
         window.location.host.includes('127.0.0.1') || 
         window.location.search.includes('test=true') || 
         process.env.NODE_ENV === 'development';
}

// Главная функция инициализации приложения
function initializeApp() {
  try {
    sharedState.log('Начало инициализации приложения');
    
    // Создаем загрузочный экран
    createLoadingScreen();
    
    // Записываем версию и платформу в отладочной информации
    sharedState.log(`Запуск приложения версии ${window.appVersion || '1.0.0'}`);
    sharedState.log(`DOM readyState: ${document.readyState}`);
    
    // Проверяем доступность Telegram WebApp API
    const isTelegramAvailable = !!(window.Telegram && window.Telegram.WebApp);
    sharedState.log(`Telegram WebApp API доступен: ${isTelegramAvailable}`);
    
    if (isTelegramAvailable) {
      try {
        // Сообщаем Telegram, что приложение готово
        window.Telegram.WebApp.ready();
        sharedState.log('Вызван метод WebApp.ready()');
        
        // Расширяем окно приложения на всю высоту
        window.Telegram.WebApp.expand();
        sharedState.log('Вызван метод WebApp.expand()');
        
        // Регистрируем обработчик события изменения области просмотра
        window.Telegram.WebApp.onEvent('viewportChanged', () => {
          sharedState.log('Событие viewportChanged получено');
          
          if (!sharedState.isInitialized) {
            sharedState.log('Приложение еще не инициализировано, запускаем инициализацию');
            sharedState.isTelegramReady = true;
            
            // Задержка для гарантии, что DOM полностью загружен
            setTimeout(() => {
              if (document.readyState === 'complete') {
                safeRenderApp();
                sharedState.isInitialized = true;
              } else {
                sharedState.log('DOM еще не полностью загружен, ожидаем загрузки');
                document.addEventListener('DOMContentLoaded', () => {
                  safeRenderApp();
                  sharedState.isInitialized = true;
                });
              }
            }, 100);
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
      } catch (telegramError) {
        sharedState.log(`Ошибка при инициализации Telegram WebApp: ${telegramError.message}`, 'error');
        addLoadingError(`Ошибка Telegram: ${telegramError.message}`);
        
        // Продолжаем запуск приложения даже при ошибке с Telegram
        setTimeout(() => {
          if (!sharedState.isInitialized) {
            sharedState.isTelegramReady = false;
            safeRenderApp();
            sharedState.isInitialized = true;
          }
        }, 500);
      }
    } else {
      sharedState.log('Telegram WebApp API не доступен, инициализируем в режиме разработки', 'warn');
      
      // В режиме разработки или при открытии вне Telegram
      if (isTestEnvironment()) {
        sharedState.log('Запуск в тестовой среде с мок-данными');
        
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
      } else {
        // Если не тестовая среда, но Telegram API недоступен, показываем сообщение об ошибке
        sharedState.log('Открытие вне Telegram в рабочей среде', 'error');
        addLoadingError('Приложение должно быть открыто в Telegram');
        
        // Показываем специальное сообщение
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
          const errorMessage = document.createElement('div');
          errorMessage.style.marginTop = '20px';
          errorMessage.style.color = '#ff4d4f';
          errorMessage.style.fontSize = '16px';
          errorMessage.style.textAlign = 'center';
          errorMessage.style.padding = '0 20px';
          errorMessage.textContent = 'Это приложение должно быть открыто через Telegram. Пожалуйста, используйте корректную ссылку.';
          loadingScreen.appendChild(errorMessage);
        }
      }
    }
  } catch (error) {
    console.error('Критическая ошибка при инициализации приложения:', error);
    addLoadingError(error.message);
    sharedState.showErrorMessage(`Критическая ошибка при инициализации: ${error.message}`);
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