/**
 * SentryTest - Компонент для тестирования функциональности Sentry
 */
import errorService from '../services/errorService.js';

class SentryTest {
  constructor() {
    this.rootElement = null;
  }

  /**
   * Инициализация компонента
   */
  init() {
    this.rootElement = document.getElementById('sentry-test-screen');
    if (!this.rootElement) return;

    this.render();
    this.setupEventListeners();
  }

  /**
   * Отрисовка компонента
   */
  render() {
    this.rootElement.innerHTML = `
      <div class="screen-container">
        <h2>Тестирование Sentry</h2>
        <div class="sentry-test-controls">
          <div class="test-section">
            <h3>Тестирование ошибок</h3>
            <button id="test-error" class="btn btn-danger">Сгенерировать ошибку</button>
            <button id="test-unhandled-promise" class="btn btn-danger">Unhandled Promise Rejection</button>
          </div>
          
          <div class="test-section">
            <h3>Тестирование сообщений</h3>
            <button id="test-info" class="btn btn-primary">Info Message</button>
            <button id="test-warning" class="btn btn-warning">Warning Message</button>
            <button id="test-error-message" class="btn btn-danger">Error Message</button>
          </div>
          
          <div class="test-section">
            <h3>Тестирование производительности</h3>
            <button id="test-transaction" class="btn btn-primary">Start Transaction</button>
          </div>
          
          <div class="test-section">
            <h3>Тестирование API</h3>
            <button id="test-backend-error" class="btn btn-danger">Backend Error</button>
          </div>
        </div>
        
        <div id="test-results" class="test-results">
          <h3>Результаты тестов</h3>
          <pre id="test-output"></pre>
        </div>
        
        <button id="sentry-test-back-btn" class="btn btn-secondary back-btn">Назад</button>
      </div>
    `;
  }

  /**
   * Настройка обработчиков событий
   */
  setupEventListeners() {
    // Тест ошибки
    document.getElementById('test-error').addEventListener('click', () => {
      try {
        throw new Error('Тестовая ошибка из SentryTest компонента');
      } catch (error) {
        this.logTestResult('Ошибка отправлена в Sentry');
        errorService.captureException(error, {
          tags: {
            testError: true,
            source: 'sentry-test-component'
          }
        });
      }
    });

    // Тест необработанного промиса
    document.getElementById('test-unhandled-promise').addEventListener('click', () => {
      this.logTestResult('Генерируем необработанный промис...');
      // Эта ошибка будет перехвачена глобальным обработчиком unhandledrejection
      new Promise((_, reject) => {
        reject(new Error('Тестовая ошибка Promise rejection'));
      });
    });

    // Тесты сообщений
    document.getElementById('test-info').addEventListener('click', () => {
      errorService.captureMessage('Тестовое информационное сообщение', 'info');
      this.logTestResult('Info сообщение отправлено в Sentry');
    });

    document.getElementById('test-warning').addEventListener('click', () => {
      errorService.captureMessage('Тестовое предупреждение', 'warning');
      this.logTestResult('Warning сообщение отправлено в Sentry');
    });

    document.getElementById('test-error-message').addEventListener('click', () => {
      errorService.captureMessage('Тестовая ошибка (сообщение)', 'error');
      this.logTestResult('Error сообщение отправлено в Sentry');
    });

    // Тест транзакций
    document.getElementById('test-transaction').addEventListener('click', () => {
      const transaction = errorService.startTransaction({
        name: 'test.transaction',
        op: 'test'
      });

      this.logTestResult('Транзакция запущена...');
      
      // Имитируем асинхронную работу
      setTimeout(() => {
        // Создаем дочерний span для конкретной операции
        const span = transaction.startChild({
          op: 'test.child',
          description: 'Тестовый дочерний span'
        });
        
        try {
          // Имитируем какую-то работу
          this.logTestResult('Выполняем операцию в рамках транзакции...');
          span.finish();
        } catch (error) {
          transaction.setStatus('error');
          this.logTestResult('Ошибка в транзакции!');
          throw error;
        }
        
        // Завершаем транзакцию
        transaction.finish();
        this.logTestResult('Транзакция завершена и отправлена в Sentry');
      }, 1000);
    });

    // Тест ошибки бэкенда
    document.getElementById('test-backend-error').addEventListener('click', async () => {
      try {
        this.logTestResult('Запрос к тестовому API бэкенда...');
        const response = await fetch('/api/debug-sentry');
        const data = await response.json();
        this.logTestResult(`Ответ от сервера: ${JSON.stringify(data)}`);
      } catch (error) {
        errorService.captureException(error, {
          tags: {
            testError: true,
            source: 'backend-api-test'
          }
        });
        this.logTestResult(`Ошибка при запросе к API: ${error.message}`);
      }
    });

    // Кнопка "Назад"
    document.getElementById('sentry-test-back-btn').addEventListener('click', () => {
      // Создаем и генерируем событие для возврата на предыдущий экран
      const event = new CustomEvent('goBack');
      this.rootElement.dispatchEvent(event);
    });
  }

  /**
   * Логирование результатов тестов
   * @param {string} message - Сообщение для вывода
   */
  logTestResult(message) {
    const output = document.getElementById('test-output');
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    output.textContent += `[${timestamp}] ${message}\n`;
    output.scrollTop = output.scrollHeight;
  }
}

export default SentryTest; 