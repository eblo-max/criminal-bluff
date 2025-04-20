# Руководство по интеграции с Telegram WebApp API

Это руководство описывает полную интеграцию мини-приложения "Криминальный Блеф" с Telegram WebApp API.

## Содержание

1. [Настройка Telegram бота](#настройка-telegram-бота)
2. [Конфигурация переменных окружения](#конфигурация-переменных-окружения)
3. [Аутентификация пользователей](#аутентификация-пользователей)
4. [Интеграция на фронтенде](#интеграция-на-фронтенде)
5. [Работа с темой Telegram](#работа-с-темой-telegram)
6. [Обработка данных и событий](#обработка-данных-и-событий)
7. [Тестирование](#тестирование)
8. [Решение проблем](#решение-проблем)

## Настройка Telegram бота

### Создание бота и настройка WebApp

1. Создайте бота через [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправьте команду `/newbot` и следуйте инструкциям для создания нового бота.
3. Сохраните токен бота (Bot API Token), который выдаст BotFather.
4. Используйте команду `/mybots`, выберите вашего бота и перейдите в "Bot Settings" > "Menu Button".
5. Выберите "Configure Menu Button" и введите URL вашего приложения.

### Настройка WebApp Menu Button

1. Используйте команду `/setmenubutton` в BotFather.
2. Выберите вашего бота.
3. Введите текст кнопки, например "Играть".
4. Введите URL мини-приложения, например: `https://example.com` (URL вашего веб-приложения).

### Настройка Inline Mode

Для возможности открытия WebApp напрямую из сообщений:

1. Используйте команду `/setinline` в BotFather.
2. Выберите вашего бота.
3. Введите текст-заполнитель для inline-запросов, например "Играть в Криминальный Блеф".
4. Отправьте `/setinlinefeedback` в BotFather и включите обратную связь.

## Конфигурация переменных окружения

Для правильной работы WebApp необходимо настроить следующие переменные окружения в вашем проекте:

```
# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_DOMAIN=https://your-domain.com
TELEGRAM_WEB_APP_URL=https://t.me/YourBotName/app
TELEGRAM_CHANNEL_ID=@YourChannelName

# Настройки Telegram WebApp
SKIP_TELEGRAM_AUTH=false # Устанавливайте true только для разработки
```

## Аутентификация пользователей

### Проверка данных инициализации WebApp

Telegram WebApp предоставляет подписанные данные инициализации через `window.Telegram.WebApp.initData`. Эти данные необходимо проверять на сервере для безопасной аутентификации пользователей.

Процесс проверки:

1. Получите initData от клиента.
2. Разделите строку на параметры.
3. Извлеките хеш и удалите его из параметров.
4. Отсортируйте все параметры в алфавитном порядке.
5. Конкатенируйте параметры как пары "ключ=значение", разделенные новой строкой.
6. Создайте секретный ключ с помощью HMAC-SHA256 из токена бота и строки 'WebAppData'.
7. Вычислите HMAC-SHA256 хеш от отсортированных параметров с использованием секретного ключа.
8. Сравните полученный хеш с хешем из initData.

### JWT аутентификация

После проверки данных WebApp:

1. Найдите или создайте пользователя в базе данных на основе Telegram ID.
2. Создайте JWT токен для последующих запросов.
3. Верните токен клиенту для сохранения в localStorage.

## Интеграция на фронтенде

### Инициализация WebApp API

```javascript
// Получаем объект WebApp из Telegram
const tg = window.Telegram?.WebApp;

// Расширяем окно на всю высоту
tg.expand();

// Получаем данные пользователя
const user = tg.initDataUnsafe?.user;

// Получаем параметры темы
const themeParams = tg.themeParams;
```

### Использование MainButton

MainButton - это основная кнопка действия внизу экрана мини-приложения:

```javascript
// Настройка MainButton
tg.MainButton.text = "Начать игру";
tg.MainButton.color = "#2cab37";
tg.MainButton.textColor = "#ffffff";
tg.MainButton.show();

// Обработчик нажатия
tg.MainButton.onClick(() => {
  startGame();
});
```

### Использование BackButton

BackButton - кнопка "Назад" в заголовке:

```javascript
// Показать кнопку
tg.BackButton.show();

// Обработчик нажатия
tg.onEvent('backButtonClicked', () => {
  navigateBack();
});
```

## Работа с темой Telegram

Telegram WebApp предоставляет цвета текущей темы Telegram, которые можно использовать для стилизации вашего приложения:

```javascript
// Получаем параметры темы
const {
  bg_color,
  text_color,
  hint_color,
  link_color,
  button_color,
  button_text_color,
  secondary_bg_color
} = tg.themeParams;

// Применяем цвета к CSS переменным
document.documentElement.style.setProperty('--tg-theme-bg-color', bg_color);
document.documentElement.style.setProperty('--tg-theme-text-color', text_color);
// и так далее для всех цветов
```

### Обработка изменений темы

```javascript
tg.onEvent('themeChanged', () => {
  // Обновите цвета в приложении
  updateThemeColors(tg.themeParams);
});
```

## Обработка данных и событий

### Отправка данных в Telegram

```javascript
// Отправка данных в бота
tg.sendData(JSON.stringify({
  action: 'share_results',
  score: 100,
  correct_answers: 5
}));
```

### Обработка событий WebApp

```javascript
// Основное меню нажатие
tg.onEvent('mainButtonClicked', handleMainButtonClick);

// Закрытие WebApp
tg.onEvent('viewportChanged', handleViewportChange);

// Изменение цветовой схемы
tg.onEvent('themeChanged', handleThemeChange);
```

### Использование Popup и Alerts

```javascript
// Показать всплывающее окно с кнопками
tg.showPopup({
  title: 'Поделиться результатами',
  message: 'Хотите поделиться своими результатами с друзьями?',
  buttons: [
    { id: 'share', type: 'default', text: 'Поделиться' },
    { id: 'cancel', type: 'cancel', text: 'Отмена' }
  ]
}, (buttonId) => {
  if (buttonId === 'share') {
    shareResults();
  }
});

// Показать простое уведомление
tg.showAlert('Игра завершена!');
```

## Тестирование

### Тестирование в локальной среде

1. Используйте [ngrok](https://ngrok.com/) или аналогичный сервис для создания HTTPS-туннеля к вашему локальному серверу.
2. Настройте WebApp URL в Telegram BotFather на URL туннеля.
3. В режиме разработки можно добавить параметр `?tgWebAppData=...` в URL для тестирования без Telegram.

### Тестирование аутентификации

Для локального тестирования без Telegram можно временно отключить проверку подписи установкой переменной окружения `SKIP_TELEGRAM_AUTH=true`.

## Решение проблем

### Общие проблемы и их решения

1. **WebApp не открывается**: Убедитесь, что URL настроен правильно в BotFather и ваш сервер доступен по HTTPS.

2. **Ошибки аутентификации**: Проверьте правильность токена бота и алгоритма проверки подписи.

3. **Проблемы с темой**: Убедитесь, что вы корректно обрабатываете параметры темы и обновляете их при изменении.

4. **Проблемы с кнопками**: MainButton и BackButton могут работать некорректно на некоторых устройствах. Всегда имейте запасной вариант навигации.

### Логи и отладка

Всегда проверяйте консоль браузера на наличие ошибок и используйте `console.log` для отладки:

```javascript
console.log('Telegram WebApp initialized:', {
  version: tg.version,
  platform: tg.platform,
  themeParams: tg.themeParams,
  initData: tg.initData ? 'available' : 'not available'
});
```

## Ресурсы и документация

- [Официальная документация Telegram WebApp](https://core.telegram.org/bots/webapps)
- [GitHub репозиторий с примерами WebApp](https://github.com/twa-dev/examples)
- [Telegram WebApp JS SDK](https://telegram.org/js/telegram-web-app.js) 