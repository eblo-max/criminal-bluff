/**
 * UI Service
 * Сервис для управления пользовательским интерфейсом
 */
export class UiService {
  constructor() {
    // Текущий активный экран
    this.currentScreen = null;
    
    // Элемент для индикатора загрузки
    this.loadingElement = null;
    
    // Элемент для всплывающих сообщений
    this.toastElement = null;
    
    // Инициализируем UI элементы
    this.init();
    
    // Логируем создание сервиса
    console.log('UiService initialized');
  }
  
  /**
   * Безопасная манипуляция с DOM-элементами
   * @param {string} selector - CSS селектор элемента
   * @param {Function} callback - функция для выполнения с элементом
   * @param {boolean} createIfMissing - создать элемент, если не найден
   * @returns {HTMLElement|null} - элемент или null, если не найден и не создан
   */
  safelyManipulateElement(selector, callback, createIfMissing = false) {
    try {
      let element;
      
      // Проверяем, является ли selector строкой (селектором) или уже HTML-элементом
      if (typeof selector === 'string') {
        element = document.querySelector(selector);
      } else if (selector instanceof HTMLElement) {
        element = selector;
      }
      
      // Если элемент не найден, но нужно создать
      if (!element && createIfMissing && typeof selector === 'string') {
        const tagMatch = selector.match(/^#([a-z0-9_-]+)$/i);
        if (tagMatch) {
          // Создаем элемент с указанным id
          element = document.createElement('div');
          element.id = tagMatch[1];
          document.body.appendChild(element);
          console.log(`Created missing element with id: ${tagMatch[1]}`);
        } else {
          console.warn(`Cannot create element from complex selector: ${selector}`);
          return null;
        }
      }
      
      // Если элемент найден, вызываем callback
      if (element) {
        callback(element);
        return element;
      }
      
      console.warn(`Element not found: ${selector}`);
      return null;
    } catch (error) {
      console.error(`Error manipulating DOM element ${selector}:`, error);
      return null;
    }
  }
  
  /**
   * Инициализация UI элементов
   */
  init() {
    try {
      console.log('Initializing UI elements');
      
      // Создаем элемент загрузки, если его еще нет
      if (!this.loadingElement) {
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'loading-overlay hidden';
        this.loadingElement.innerHTML = `
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
        `;
        document.body.appendChild(this.loadingElement);
        
        // Добавляем стили для индикатора загрузки
        const style = document.createElement('style');
        style.textContent = `
          .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          
          .loading-overlay.hidden {
            display: none;
          }
          
          .loading-spinner {
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .toast {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 9999;
            font-size: 14px;
            text-align: center;
            max-width: 80%;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          
          .toast.visible {
            opacity: 1;
          }
          
          .toast.error {
            background-color: var(--error-color);
          }
          
          .toast.success {
            background-color: var(--success-color);
          }
          
          .screen {
            display: none;
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          
          .screen.active {
            display: block;
            opacity: 1;
          }
          
          .screen-enter {
            animation: fadeIn 0.3s ease;
          }
          
          .screen-exit {
            animation: fadeOut 0.3s ease;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
      
      // Создаем элемент для всплывающих сообщений
      if (!this.toastElement) {
        this.toastElement = document.createElement('div');
        this.toastElement.className = 'toast';
        document.body.appendChild(this.toastElement);
      }
      
      // Создаем контейнер приложения, если его нет
      this.safelyManipulateElement('#app', () => {}, true);
      
      console.log('UI elements initialized successfully');
    } catch (error) {
      console.error('Error initializing UI elements:', error);
    }
  }
  
  /**
   * Отображение экрана
   * @param {HTMLElement} screen - элемент экрана для отображения
   */
  showScreen(screen) {
    try {
      if (!screen) {
        console.warn('Attempted to show null screen');
        return;
      }
      
      // Проверяем, является ли screen строкой (id экрана) или HTML-элементом
      let screenElement = screen;
      if (typeof screen === 'string') {
        screenElement = document.getElementById(`${screen}-screen`);
        if (!screenElement) {
          console.error(`Screen element with id "${screen}-screen" not found`);
          // Создаем временный экран
          this._createEmptyScreen(screen);
          return;
        }
      }
      
      // Скрываем текущий экран, если он есть
      if (this.currentScreen) {
        this.safelyManipulateElement(this.currentScreen, (element) => {
          element.classList.remove('active');
          
          // Анимация выхода
          element.classList.add('screen-exit');
          setTimeout(() => {
            this.safelyManipulateElement(element, (el) => {
              el.classList.remove('screen-exit');
            });
          }, 300);
        });
      }
      
      // Отображаем новый экран
      this.safelyManipulateElement(screenElement, (element) => {
        element.classList.add('active');
        
        // Анимация входа
        element.classList.add('screen-enter');
        setTimeout(() => {
          this.safelyManipulateElement(element, (el) => {
            el.classList.remove('screen-enter');
          });
        }, 300);
        
        // Запоминаем новый текущий экран
        this.currentScreen = element;
        
        // Прокрутка в начало
        window.scrollTo(0, 0);
      });
      
      console.log(`Screen displayed: ${screen instanceof HTMLElement ? screen.id : screen}`);
    } catch (error) {
      console.error('Error showing screen:', error);
    }
  }
  
  /**
   * Создает пустой экран с сообщением об ошибке
   * @param {string} screenName - имя экрана
   * @private
   */
  _createEmptyScreen(screenName) {
    try {
      console.log(`Creating temporary screen: ${screenName}`);
      
      const screenId = `${screenName}-screen`;
      const appContainer = document.getElementById('app');
      
      if (!appContainer) {
        console.error('App container not found, creating it');
        const app = document.createElement('div');
        app.id = 'app';
        document.body.appendChild(app);
      }
      
      // Создаем элемент экрана
      const screenElement = document.createElement('div');
      screenElement.id = screenId;
      screenElement.className = 'screen';
      
      // Добавляем контент
      screenElement.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2>Экран "${screenName}" не найден</h2>
          <p>Произошла ошибка при загрузке экрана. Попробуйте перезагрузить приложение.</p>
          <button onclick="location.reload()">Перезагрузить</button>
        </div>
      `;
      
      // Добавляем в DOM
      document.getElementById('app').appendChild(screenElement);
      
      // Показываем этот экран
      this.showScreen(screenElement);
    } catch (error) {
      console.error('Error creating empty screen:', error);
    }
  }
  
  /**
   * Отображение индикатора загрузки
   */
  showLoading() {
    this.safelyManipulateElement(this.loadingElement, (element) => {
      element.classList.remove('hidden');
    });
  }
  
  /**
   * Скрытие индикатора загрузки
   */
  hideLoading() {
    this.safelyManipulateElement(this.loadingElement, (element) => {
      element.classList.add('hidden');
    });
  }
  
  /**
   * Отображение всплывающего сообщения
   * @param {string} message - текст сообщения
   * @param {string} type - тип сообщения ('error', 'success', 'info')
   * @param {number} duration - длительность отображения в миллисекундах
   */
  showToast(message, type = 'info', duration = 3000) {
    this.safelyManipulateElement(this.toastElement, (element) => {
      // Устанавливаем текст и класс
      element.textContent = message;
      element.className = 'toast';
      
      if (type === 'error') {
        element.classList.add('error');
      } else if (type === 'success') {
        element.classList.add('success');
      }
      
      // Отображаем сообщение
      setTimeout(() => {
        this.safelyManipulateElement(element, (el) => {
          el.classList.add('visible');
        });
      }, 10);
      
      // Скрываем через указанное время
      setTimeout(() => {
        this.safelyManipulateElement(element, (el) => {
          el.classList.remove('visible');
        });
      }, duration);
    });
  }
  
  /**
   * Отображение сообщения об ошибке
   * @param {string} message - текст сообщения
   */
  showError(message) {
    console.error('Error:', message);
    this.showToast(message, 'error');
  }
  
  /**
   * Отображение сообщения об успехе
   * @param {string} message - текст сообщения
   */
  showSuccess(message) {
    this.showToast(message, 'success');
  }
  
  /**
   * Применение темы Telegram
   * @param {Object} themeParams - параметры темы из Telegram.WebApp
   */
  applyTheme(themeParams) {
    if (!themeParams) {
      console.warn('No theme params provided to applyTheme');
      return;
    }
    
    try {
      console.log('Applying theme from Telegram WebApp:', themeParams);
      
      const root = document.documentElement;
      
      // Если тема тёмная
      if (themeParams.text_color && themeParams.bg_color) {
        if (this.isDarkColor(themeParams.bg_color)) {
          // Тёмная тема
          document.body.classList.remove('theme-light');
          
          // Устанавливаем цвета для темной темы
          root.style.setProperty('--bg-color', themeParams.bg_color);
          root.style.setProperty('--text-color', themeParams.text_color);
        } else {
          // Светлая тема
          document.body.classList.add('theme-light');
          
          // Устанавливаем цвета из Telegram
          root.style.setProperty('--bg-color', themeParams.bg_color);
          root.style.setProperty('--text-color', themeParams.text_color);
        }
        
        // Вычисляем вторичный цвет фона
        const bgSecondary = this.adjustBrightness(themeParams.bg_color, -10);
        root.style.setProperty('--bg-secondary', bgSecondary);
        
        // Вычисляем вторичный цвет текста
        const textSecondary = this.adjustOpacity(themeParams.text_color, 0.7);
        root.style.setProperty('--text-secondary', textSecondary);
        
        // Устанавливаем акцентный цвет из Telegram, если он есть
        if (themeParams.button_color) {
          root.style.setProperty('--accent-color', themeParams.button_color);
          
          // Вычисляем цвет при наведении
          const accentHover = this.adjustBrightness(themeParams.button_color, 10);
          root.style.setProperty('--accent-hover', accentHover);
        }
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }
  
  /**
   * Определяет, является ли цвет темным
   * @param {string} color - HEX цвет
   * @returns {boolean} true если цвет темный
   */
  isDarkColor(color) {
    try {
      // Преобразуем цвет в RGB
      let hex = color.replace('#', '');
      
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Вычисляем яркость
      // Формула: 0.299*R + 0.587*G + 0.114*B
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      
      // Если яркость < 128, то цвет темный
      return brightness < 128;
    } catch (error) {
      console.error('Error in isDarkColor:', error);
      return false;
    }
  }
  
  /**
   * Изменяет яркость цвета на указанный процент
   * @param {string} color - HEX цвет
   * @param {number} percent - процент изменения (-100 до 100)
   * @returns {string} новый HEX цвет
   */
  adjustBrightness(color, percent) {
    try {
      let hex = color.replace('#', '');
      
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      // Преобразуем в RGB
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      
      // Изменяем яркость
      r = this.clamp(r + Math.round(r * (percent / 100)));
      g = this.clamp(g + Math.round(g * (percent / 100)));
      b = this.clamp(b + Math.round(b * (percent / 100)));
      
      // Преобразуем обратно в HEX
      return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
    } catch (error) {
      console.error('Error in adjustBrightness:', error);
      return color;
    }
  }
  
  /**
   * Изменяет прозрачность цвета
   * @param {string} color - HEX цвет
   * @param {number} opacity - прозрачность (0 до 1)
   * @returns {string} цвет в формате rgba
   */
  adjustOpacity(color, opacity) {
    try {
      let hex = color.replace('#', '');
      
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      // Преобразуем в RGB
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      // Возвращаем rgba
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    } catch (error) {
      console.error('Error in adjustOpacity:', error);
      return color;
    }
  }
  
  /**
   * Ограничивает значение в пределах min и max
   * @param {number} value - значение
   * @param {number} min - минимум
   * @param {number} max - максимум
   * @returns {number} ограниченное значение
   */
  clamp(value, min = 0, max = 255) {
    return Math.min(Math.max(value, min), max);
  }
  
  /**
   * Преобразует число в HEX строку
   * @param {number} value - число
   * @returns {string} HEX строка
   */
  toHex(value) {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
} 