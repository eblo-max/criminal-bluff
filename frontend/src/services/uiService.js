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
  }
  
  /**
   * Инициализация UI элементов
   */
  init() {
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
      `;
      document.head.appendChild(style);
    }
    
    // Создаем элемент для всплывающих сообщений
    if (!this.toastElement) {
      this.toastElement = document.createElement('div');
      this.toastElement.className = 'toast';
      document.body.appendChild(this.toastElement);
    }
  }
  
  /**
   * Отображение экрана
   * @param {HTMLElement} screen - элемент экрана для отображения
   */
  showScreen(screen) {
    if (!screen) return;
    
    // Скрываем текущий экран, если он есть
    if (this.currentScreen) {
      this.currentScreen.classList.remove('active');
      
      // Анимация выхода
      this.currentScreen.classList.add('screen-exit');
      setTimeout(() => {
        this.currentScreen.classList.remove('screen-exit');
      }, 300);
    }
    
    // Отображаем новый экран
    screen.classList.add('active');
    
    // Анимация входа
    screen.classList.add('screen-enter');
    setTimeout(() => {
      screen.classList.remove('screen-enter');
    }, 300);
    
    // Запоминаем новый текущий экран
    this.currentScreen = screen;
    
    // Прокрутка в начало
    window.scrollTo(0, 0);
  }
  
  /**
   * Отображение индикатора загрузки
   */
  showLoading() {
    this.loadingElement.classList.remove('hidden');
  }
  
  /**
   * Скрытие индикатора загрузки
   */
  hideLoading() {
    this.loadingElement.classList.add('hidden');
  }
  
  /**
   * Отображение всплывающего сообщения
   * @param {string} message - текст сообщения
   * @param {string} type - тип сообщения ('error', 'success', 'info')
   * @param {number} duration - длительность отображения в миллисекундах
   */
  showToast(message, type = 'info', duration = 3000) {
    // Устанавливаем текст и класс
    this.toastElement.textContent = message;
    this.toastElement.className = 'toast';
    
    if (type === 'error') {
      this.toastElement.classList.add('error');
    } else if (type === 'success') {
      this.toastElement.classList.add('success');
    }
    
    // Отображаем сообщение
    setTimeout(() => {
      this.toastElement.classList.add('visible');
    }, 10);
    
    // Скрываем через указанное время
    setTimeout(() => {
      this.toastElement.classList.remove('visible');
    }, duration);
  }
  
  /**
   * Отображение сообщения об ошибке
   * @param {string} message - текст сообщения
   */
  showError(message) {
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
    if (!themeParams) return;
    
    const root = document.documentElement;
    
    // Если тема тёмная
    if (themeParams.text_color && themeParams.bg_color) {
      if (this.isDarkColor(themeParams.bg_color)) {
        // Тёмная тема
        document.body.classList.remove('theme-light');
      } else {
        // Светлая тема
        document.body.classList.add('theme-light');
        
        // Устанавливаем цвета из Telegram
        root.style.setProperty('--bg-color', themeParams.bg_color);
        root.style.setProperty('--text-color', themeParams.text_color);
        
        // Вычисляем вторичный цвет фона
        const bgSecondary = this.adjustBrightness(themeParams.bg_color, -10);
        root.style.setProperty('--bg-secondary', bgSecondary);
        
        // Вычисляем вторичный цвет текста
        const textSecondary = this.adjustOpacity(themeParams.text_color, 0.7);
        root.style.setProperty('--text-secondary', textSecondary);
      }
      
      // Устанавливаем акцентный цвет из Telegram, если он есть
      if (themeParams.button_color) {
        root.style.setProperty('--accent-color', themeParams.button_color);
        
        // Вычисляем цвет при наведении
        const accentHover = this.adjustBrightness(themeParams.button_color, 10);
        root.style.setProperty('--accent-hover', accentHover);
        
        // Обновляем цвет свечения
        const neonGlow = `0 0 8px ${this.adjustOpacity(themeParams.button_color, 0.6)}`;
        root.style.setProperty('--neon-glow', neonGlow);
      }
    }
  }
  
  /**
   * Проверка, является ли цвет тёмным
   * @param {string} color - цвет в формате HEX
   * @returns {boolean} - true, если цвет тёмный
   */
  isDarkColor(color) {
    // Убираем # из начала строки, если есть
    color = color.replace('#', '');
    
    // Преобразуем hex в RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    
    // Вычисляем яркость
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Если яркость меньше 128, считаем цвет тёмным
    return brightness < 128;
  }
  
  /**
   * Изменение яркости цвета
   * @param {string} color - цвет в формате HEX
   * @param {number} percent - процент изменения яркости (-100 до 100)
   * @returns {string} - новый цвет
   */
  adjustBrightness(color, percent) {
    // Убираем # из начала строки, если есть
    color = color.replace('#', '');
    
    // Преобразуем hex в RGB
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    
    // Изменяем яркость
    r = this.clamp(r + (percent / 100) * 255);
    g = this.clamp(g + (percent / 100) * 255);
    b = this.clamp(b + (percent / 100) * 255);
    
    // Преобразуем обратно в HEX
    return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
  }
  
  /**
   * Изменение прозрачности цвета
   * @param {string} color - цвет в формате HEX
   * @param {number} opacity - новое значение прозрачности (0-1)
   * @returns {string} - новый цвет в формате rgba
   */
  adjustOpacity(color, opacity) {
    // Убираем # из начала строки, если есть
    color = color.replace('#', '');
    
    // Преобразуем hex в RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    
    // Возвращаем цвет в формате rgba
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  /**
   * Ограничение значения
   * @param {number} value - значение для ограничения
   * @param {number} min - минимальное значение
   * @param {number} max - максимальное значение
   * @returns {number} - ограниченное значение
   */
  clamp(value, min = 0, max = 255) {
    return Math.min(Math.max(value, min), max);
  }
  
  /**
   * Преобразование числа в HEX
   * @param {number} value - значение для преобразования
   * @returns {string} - HEX строка
   */
  toHex(value) {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
} 