import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import './index.css';
import { sharedState } from './services/common.js';
import './app.css';

// Максимальное количество попыток инициализации
const MAX_INIT_ATTEMPTS = 5;
let initAttempts = 0;

// Глобальные обработчики ошибок
window.onerror = function(message, source, lineno, colno, error) {
  sharedState.log(`Непойманная ошибка: ${message} на ${source}:${lineno}:${colno}`, 'error');
  
  // Показываем сообщение об ошибке
  sharedState.showErrorMessage(`Произошла ошибка: ${message}`);
  
  // Если есть экран загрузки, скрываем его
  const loadingEl = document.getElementById('loading-screen');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
  
  return false; // Позволяет стандартному обработчику ошибок браузера выполниться
};

// Обработчик необработанных Promise rejection
window.addEventListener('unhandledrejection', function(event) {
  handleGlobalError(event.reason || 'Необработанная ошибка Promise');
});

/**
 * Обработчик глобальных ошибок
 */
function handleGlobalError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Глобальная ошибка:', errorMessage);
  
  if (sharedState) {
    sharedState.log(`Глобальная ошибка: ${errorMessage}`, 'error');
    sharedState.showErrorMessage(errorMessage);
  } else {
    showErrorOnScreen(errorMessage);
  }
}

/**
 * Показывает сообщение об ошибке на экране без использования сервисов
 */
function showErrorOnScreen(message) {
  try {
    let errorContainer = document.getElementById('error-messages');
    
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = 'error-messages';
      errorContainer.style.position = 'fixed';
      errorContainer.style.top = '10px';
      errorContainer.style.left = '10px';
      errorContainer.style.right = '10px';
      errorContainer.style.zIndex = '10000';
      errorContainer.style.display = 'flex';
      errorContainer.style.flexDirection = 'column';
      errorContainer.style.alignItems = 'center';
      document.body.appendChild(errorContainer);
    }
    
    const errorElement = document.createElement('div');
    errorElement.style.backgroundColor = 'rgba(255, 77, 79, 0.9)';
    errorElement.style.color = 'white';
    errorElement.style.padding = '10px 16px';
    errorElement.style.borderRadius = '4px';
    errorElement.style.maxWidth = '100%';
    errorElement.style.width = '90%';
    errorElement.style.boxSizing = 'border-box';
    errorElement.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    errorElement.style.marginBottom = '8px';
    errorElement.style.fontSize = '14px';
    errorElement.style.textAlign = 'center';
    errorElement.textContent = message;
    
    errorContainer.appendChild(errorElement);
    
    // Автоматически скрываем ошибку через 5 секунд
    setTimeout(() => {
      errorElement.style.opacity = '0';
      errorElement.style.transition = 'opacity 0.5s ease';
      
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
        }
      }, 500);
    }, 5000);
  } catch (e) {
    console.error('Ошибка при отображении сообщения об ошибке:', e);
  }
}

/**
 * Создает экран загрузки с анимацией и отладочной информацией
 */
function createLoadingScreen() {
  // Проверяем, существует ли уже экран загрузки
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
  loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  loadingScreen.style.display = 'flex';
  loadingScreen.style.flexDirection = 'column';
  loadingScreen.style.justifyContent = 'center';
  loadingScreen.style.alignItems = 'center';
  loadingScreen.style.zIndex = '1000';
  
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
  spinner.style.borderTop = '4px solid #ffffff';
  spinner.style.borderRadius = '50%';
  spinner.style.width = '40px';
  spinner.style.height = '40px';
  spinner.style.animation = 'spin 1s linear infinite';
  
  const loadingText = document.createElement('div');
  loadingText.textContent = 'Загрузка игры...';
  loadingText.style.color = 'white';
  loadingText.style.marginTop = '10px';
  loadingText.style.fontFamily = 'Arial, sans-serif';
  
  // Добавляем анимацию
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
  loadingScreen.appendChild(spinner);
  loadingScreen.appendChild(loadingText);
  document.body.appendChild(loadingScreen);
}

/**
 * Безопасный рендеринг приложения
 */
async function safeRender() {
  try {
    // Создаем экран загрузки
    const loadingScreen = createLoadingScreen();
    
    // Инициализируем Telegram WebApp
    await initializeTelegramWebApp();
    
    // Импортируем модуль приложения
    const { App } = await import('./app.js');
    
    // Убедимся, что DOM полностью загружен
    if (document.readyState !== 'complete') {
      sharedState.log('DOM еще не полностью загружен, ожидаем...', 'warn');
      window.addEventListener('load', () => startApplication(App, loadingScreen));
    } else {
      startApplication(App, loadingScreen);
    }
  } catch (error) {
    handleGlobalError(error);
  }
}

/**
 * Запускает приложение
 */
function startApplication(App, loadingScreen) {
  try {
    // Проверяем наличие корневого элемента
    let rootElement = document.getElementById('root');
    
    // Если корневой элемент не существует, создаем его
    if (!rootElement) {
      sharedState.log('Корневой элемент не найден, создаем новый', 'warn');
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }
    
    // Инициализируем и запускаем приложение
    const app = new App();
    app.render();
    
    // Скрываем экран загрузки
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
          if (loadingScreen.parentNode) {
            loadingScreen.parentNode.removeChild(loadingScreen);
          }
        }, 500);
      }, 500);
    }
    
    sharedState.log('Приложение успешно запущено', 'info');
  } catch (error) {
    handleGlobalError(error);
  }
}

/**
 * Проверяет доступность API Telegram WebApp
 */
function isTelegramApiAvailable() {
  return (
    typeof window !== 'undefined' &&
    window.Telegram &&
    window.Telegram.WebApp
  );
}

/**
 * Инициализирует Telegram WebApp
 */
async function initializeTelegramWebApp() {
  // Увеличиваем счетчик попыток инициализации
  initAttempts++;
  
  sharedState.log(`Попытка инициализации Telegram WebApp ${initAttempts}/${MAX_INIT_ATTEMPTS}`);
  
  // Если мы работаем в среде разработки без Telegram API
  if (process.env.NODE_ENV === 'development' && !isTelegramApiAvailable()) {
    sharedState.log('Режим разработки: используем моковые данные для Telegram WebApp', 'warn');
    
    // Создаем моковый объект Telegram WebApp
    window.Telegram = {
      WebApp: {
        ready: () => {
          sharedState.log('Мок Telegram.WebApp.ready() вызван');
        },
        initData: 'mock_init_data',
        initDataUnsafe: {
          user: {
            id: 123456789,
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'ru'
          }
        },
        themeParams: {
          bg_color: '#ffffff',
          text_color: '#000000',
          hint_color: '#999999',
          link_color: '#0000cc',
          button_color: '#5288c1',
          button_text_color: '#ffffff'
        },
        onEvent: (eventType, callback) => {
          sharedState.log(`Мок Telegram.WebApp.onEvent(${eventType}) зарегистрирован`);
        },
        MainButton: {
          show: () => {},
          hide: () => {},
          setText: (text) => {},
          onClick: (callback) => {}
        },
        BackButton: {
          show: () => {},
          hide: () => {},
          onClick: (callback) => {}
        },
        isExpanded: true,
        expand: () => {},
        close: () => {}
      }
    };
    
    // Устанавливаем флаг готовности API
    sharedState.isTelegramReady = true;
    return;
  }
  
  // Проверяем доступность Telegram API
  if (!isTelegramApiAvailable()) {
    // Если это не первая попытка, проверяем, сколько попыток было сделано
    if (initAttempts >= MAX_INIT_ATTEMPTS) {
      throw new Error('Не удалось инициализировать Telegram WebApp после нескольких попыток');
    }
    
    // Ждем и пробуем снова
    sharedState.log('Telegram WebApp API не найден, ожидаем...', 'warn');
    await new Promise(resolve => setTimeout(resolve, 500));
    return initializeTelegramWebApp();
  }
  
  // Инициализируем Telegram WebApp
  sharedState.log('Telegram WebApp API доступен, инициализация...');
  
  try {
    // Уведомляем Telegram, что приложение готово
    window.Telegram.WebApp.ready();
    
    // Устанавливаем обработчик смены размера контейнера
    window.Telegram.WebApp.onEvent('viewportChanged', () => {
      sharedState.log('Изменение размера viewport в Telegram WebApp');
    });
    
    // Устанавливаем флаг готовности API
    sharedState.isTelegramReady = true;
    sharedState.log('Telegram WebApp успешно инициализирован');
    
    // Сохраняем данные пользователя и темы
    sharedState.userData = window.Telegram.WebApp.initDataUnsafe.user;
    sharedState.themeParams = window.Telegram.WebApp.themeParams;
    
    // Применяем тему Telegram к корню документа
    if (sharedState.themeParams) {
      document.documentElement.style.setProperty('--tg-theme-bg-color', sharedState.themeParams.bg_color);
      document.documentElement.style.setProperty('--tg-theme-text-color', sharedState.themeParams.text_color);
      document.documentElement.style.setProperty('--tg-theme-hint-color', sharedState.themeParams.hint_color);
      document.documentElement.style.setProperty('--tg-theme-link-color', sharedState.themeParams.link_color);
      document.documentElement.style.setProperty('--tg-theme-button-color', sharedState.themeParams.button_color);
      document.documentElement.style.setProperty('--tg-theme-button-text-color', sharedState.themeParams.button_text_color);
    }
  } catch (error) {
    sharedState.log(`Ошибка при инициализации Telegram WebApp: ${error.message}`, 'error');
    throw error;
  }
}

// Запускаем приложение
safeRender(); 