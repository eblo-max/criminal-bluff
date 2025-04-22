import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/react';
import App from './app';
import './index.css';
import errorService from './services/errorService';

// Инициализируем errorService
errorService.init();

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

// Оборачиваем приложение в ErrorBoundary от Sentry
ReactDOM.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Произошла ошибка при загрузке приложения. Пожалуйста, обновите страницу.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
); 