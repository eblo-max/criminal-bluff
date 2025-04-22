import React from 'react';
import ReactDOM from 'react-dom';
import { ErrorBoundary } from '@sentry/react';
import App from './app';
import './index.css';
import errorService from './services/errorService';

// Инициализируем errorService
errorService.init();

// Делаем errorService доступным глобально для обработчиков ошибок
window.errorService = errorService;

// Добавляем тестовую кнопку для проверки Sentry (только в режиме разработки)
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('DOMContentLoaded', () => {
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Sentry Error';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '10px';
    testButton.style.right = '10px';
    testButton.style.zIndex = '9999';
    testButton.style.padding = '8px 12px';
    testButton.style.backgroundColor = '#ff4d4f';
    testButton.style.color = 'white';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    
    testButton.addEventListener('click', () => {
      try {
        throw new Error('This is a test error from Criminal Bluff app!');
      } catch (error) {
        errorService.captureException(error, {
          tags: {
            testError: true,
            source: 'test-button'
          }
        });
        alert('Test error sent to Sentry!');
      }
    });
    
    document.body.appendChild(testButton);
  });
}

// Оборачиваем приложение в ErrorBoundary от Sentry через errorService
ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary 
      fallback={({error, componentStack, resetError}) => (
        <div>
          <h2>Произошла ошибка при загрузке приложения</h2>
          <p>Пожалуйста, обновите страницу или попробуйте позже.</p>
          <button onClick={resetError}>Попробовать снова</button>
        </div>
      )}
      beforeCapture={(scope) => {
        scope.setTag("location", "error-boundary");
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);

// Загрузка основного файла приложения
import './app.js';

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
    
    // Если определена глобальная функция отправки ошибок в Sentry
    if (window.errorService) {
      window.errorService.captureException(error || new Error(message));
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
    
    // Если определена глобальная функция отправки ошибок в Sentry
    if (window.errorService) {
      window.errorService.captureException(event.reason);
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