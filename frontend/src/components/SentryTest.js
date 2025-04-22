/**
 * Компонент для тестирования Sentry
 * Позволяет протестировать различные типы ошибок и функциональность Sentry
 * 
 * Этот компонент использует Sentry 9.x API
 */
import * as sentryService from '../services/sentryService';

class SentryTest {
  constructor() {
    this.initialized = false;
    this.logs = [];
  }

  init() {
    if (this.initialized) return;

    this.renderUI();
    this.setupEventListeners();
    this.initialized = true;
    this.log('Компонент SentryTest инициализирован');
  }

  renderUI() {
    const container = document.getElementById('sentryTest-screen');
    if (!container) {
      console.error('Container #sentryTest-screen not found');
      return;
    }

    container.innerHTML = `
      <div class="sentry-test-container">
        <h1>Тестирование Sentry</h1>
        <p>Используйте кнопки ниже для проверки функциональности Sentry</p>
        
        <div class="test-buttons">
          <button id="testError" class="test-button">Сгенерировать ошибку</button>
          <button id="testMessage" class="test-button">Отправить сообщение</button>
          <button id="testPerformance" class="test-button">Тест производительности</button>
          <button id="testApiError" class="test-button">Тест ошибки API</button>
          <button id="testReactError" class="test-button">Тест React ошибки</button>
        </div>
        
        <div class="logs-container">
          <h3>Логи тестирования:</h3>
          <div id="sentryTestLogs" class="logs"></div>
        </div>
      </div>
    `;

    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
      .sentry-test-container {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }
      .test-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 20px 0;
      }
      .test-button {
        padding: 10px 15px;
        background-color: #1890ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .logs-container {
        margin-top: 20px;
        padding: 15px;
        background-color: #f5f5f5;
        border-radius: 4px;
        height: 300px;
        overflow-y: auto;
      }
      .logs {
        font-family: monospace;
        font-size: 12px;
        line-height: 1.5;
      }
      .log-entry {
        margin-bottom: 5px;
        padding: 5px;
        border-bottom: 1px solid #e8e8e8;
      }
      .log-error {
        color: #ff4d4f;
      }
      .log-success {
        color: #52c41a;
      }
      .log-info {
        color: #1890ff;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Test Error Button
    document.getElementById('testError').addEventListener('click', () => {
      try {
        this.log('Генерация тестовой ошибки...', 'info');
        throw new Error('Это тестовая ошибка из SentryTest компонента');
      } catch (error) {
        this.log(`Ошибка сгенерирована: ${error.message}`, 'error');
        sentryService.captureException(error, {
          tags: {
            testError: true,
            component: 'SentryTest'
          },
          extra: {
            timestamp: new Date().toISOString()
          }
        });
        this.log('Ошибка отправлена в Sentry', 'info');
      }
    });

    // Test Message Button
    document.getElementById('testMessage').addEventListener('click', () => {
      this.log('Отправка тестового сообщения...', 'info');
      sentryService.captureMessage('Это тестовое сообщение из SentryTest компонента', {
        level: 'info',
        tags: {
          testMessage: true,
          component: 'SentryTest'
        }
      });
      this.log('Сообщение отправлено в Sentry', 'success');
    });

    // Test Performance Button
    document.getElementById('testPerformance').addEventListener('click', () => {
      this.log('Запуск тестирования производительности...', 'info');
      
      // Создаем транзакцию с использованием API Sentry 9.x
      const transaction = sentryService.startTransaction({
        name: 'test-transaction',
        op: 'test',
        data: { test: true }
      });

      // Измеряем время выполнения тяжелой операции
      try {
        this.log('Начало выполнения тяжелой операции', 'info');
        
        // Создаем дочернюю span операцию
        const span = transaction.startChild({
          op: 'task',
          description: 'Heavy computational task'
        });
        
        // Выполняем "тяжелую" операцию
        this.heavyOperation();
        
        span.finish();
        this.log('Операция завершена успешно', 'success');
        
        // Завершаем транзакцию
        transaction.finish();
      } catch (error) {
        this.log(`Ошибка при выполнении операции: ${error.message}`, 'error');
        transaction.setStatus('internal_error');
        transaction.finish();
        
        sentryService.captureException(error, {
          tags: { component: 'SentryTest', operation: 'performanceTest' }
        });
      }
    });

    // Test API Error Button
    document.getElementById('testApiError').addEventListener('click', () => {
      this.log('Симуляция ошибки API запроса...', 'info');
      
      // Начинаем транзакцию API запроса
      const transaction = sentryService.startTransaction({
        name: 'api-request',
        op: 'http.client',
        data: { testMode: true }
      });
      
      // Симулируем ошибку API
      setTimeout(() => {
        try {
          this.log('Выполняется запрос к несуществующему API...', 'info');
          throw new Error('404 Not Found: API endpoint /test/error не существует');
        } catch (error) {
          this.log(`Произошла ошибка API: ${error.message}`, 'error');
          
          // Устанавливаем статус транзакции и завершаем её
          transaction.setStatus('internal_error');
          transaction.finish();
          
          // Добавляем контекст HTTP запроса
          sentryService.setContext('request', {
            url: 'https://api.example.com/test/error',
            method: 'GET',
            status_code: 404
          });
          
          // Отправляем ошибку в Sentry
          sentryService.captureException(error, {
            tags: {
              component: 'SentryTest',
              apiTest: true
            }
          });
        }
      }, 500);
    });

    // Test React Error Button
    document.getElementById('testReactError').addEventListener('click', () => {
      this.log('Симуляция ошибки в React компоненте...', 'info');
      
      try {
        // Симулируем ошибку в React компоненте
        const fakeComponent = { props: null };
        const result = fakeComponent.props.nonExistingMethod();
      } catch (error) {
        this.log(`Ошибка React компонента: ${error.message}`, 'error');
        
        // Устанавливаем контекст React компонента
        sentryService.setContext('react', {
          componentStack: `
    in TestComponent (created by App)
    in ErrorBoundary (created by App)
    in div (created by App)
    in App`,
          componentName: 'TestComponent'
        });
        
        // Отправляем ошибку в Sentry
        sentryService.captureException(error, {
          tags: {
            component: 'SentryTest',
            errorType: 'react'
          }
        });
        
        this.log('Ошибка React компонента отправлена в Sentry', 'info');
      }
    });
  }

  heavyOperation() {
    // Симуляция тяжелой операции
    this.log('Выполнение тяжелой операции...', 'info');
    
    const start = performance.now();
    
    // Создаём большой массив и выполняем операции с ним
    const arr = new Array(1000000);
    for (let i = 0; i < 1000000; i++) {
      arr[i] = Math.sqrt(i * Math.random());
    }
    
    // Сортировка массива
    arr.sort();
    
    const duration = performance.now() - start;
    this.log(`Операция завершена за ${duration.toFixed(2)}мс`, 'success');
  }

  log(message, type = 'info') {
    // Добавляем сообщение в логи
    this.logs.push({ message, type, timestamp: new Date() });
    
    // Обновляем UI логов
    const logsContainer = document.getElementById('sentryTestLogs');
    if (logsContainer) {
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry log-${type}`;
      logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      logsContainer.appendChild(logEntry);
      
      // Скроллим к последнему сообщению
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
    
    // Также логируем в консоль
    console.log(`[SentryTest] ${message}`);
  }
}

export default SentryTest; 