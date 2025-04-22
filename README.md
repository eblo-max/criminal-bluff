# Криминальный Блеф - Telegram Mini App

Викторина-игра, в которой пользователи угадывают ошибки преступников в реальных историях. Мини-приложение для Telegram.

## Описание проекта

"Криминальный Блеф" - это увлекательная викторина для Telegram, где игроки читают короткие криминальные истории и выбирают, какая деталь стала роковой ошибкой преступника. Игра сочетает развлечение с познавательным контентом и позволяет пользователям проверить свои детективные способности.

## Технологический стек

### Frontend
- HTML5, CSS3, JavaScript (без фреймворков)
- Telegram WebApp API для интеграции с Telegram
- Vite для сборки проекта

### Backend
- Node.js, Express.js
- MongoDB для хранения данных
- Redis для кэширования и хранения рейтингов
- JWT для аутентификации

### Деплой
- Railway для хостинга

## Основные функции

- Игровой процесс с 5 случайными историями в каждой игре
- Система подсчета очков с бонусами за скорость и серии правильных ответов
- Рейтинги игроков (дневной, недельный, за все время)
- Система достижений
- Профили пользователей со статистикой
- Интеграция с Telegram (авторизация, шаринг результатов)

## Установка и запуск

1. Клонировать репозиторий:
```
git clone <repository-url>
cd criminal-bluff
```

2. Установить зависимости:
```
npm run install-all
```

3. Создать файлы .env в корне и в папке backend (на основе .env.example):
```
cp .env.example .env
cp backend/.env.example backend/.env
```

4. Заполнить .env файлы необходимыми значениями

5. Запустить приложение в режиме разработки:
```
npm run dev
```

## Структура проекта

```
criminal-bluff/
├── backend/
│   ├── src/
│   │   ├── config/       # Конфигурация приложения
│   │   ├── controllers/  # Контроллеры API
│   │   ├── middlewares/  # Middleware
│   │   ├── models/       # MongoDB модели
│   │   ├── routes/       # API маршруты
│   │   ├── services/     # Сервисы
│   │   └── utils/        # Утилиты
│   ├── tests/            # Тесты
│   └── .env.example      # Пример переменных окружения
├── frontend/
│   ├── src/
│   │   ├── assets/       # Изображения, шрифты и т.д.
│   │   ├── components/   # UI компоненты
│   │   ├── services/     # Клиентские сервисы
│   │   └── styles/       # CSS стили
│   ├── index.html        # Основной HTML файл
│   └── vite.config.js    # Конфигурация Vite
├── .env.example          # Пример переменных окружения
├── README.md             # Документация проекта
└── package.json          # Зависимости и скрипты
```

## Деплой на Railway

1. Создать аккаунт на [Railway](https://railway.app/)
2. Создать новый проект и подключить GitHub репозиторий
3. Добавить сервисы:
   - MongoDB
   - Redis
   - Node.js
4. Настроить переменные окружения в соответствии с .env.example
5. Настроить домен и SSL

## Интеграция с Telegram Bot API

1. Создать нового бота через [BotFather](https://t.me/botfather)
2. Получить токен бота
3. Настроить вебхуки для получения обновлений
4. Добавить мини-приложение к боту через BotFather

## Авторы

Разработано [Вашим именем/командой]

## Лицензия

MIT 

# Criminal Bluff - Мониторинг ошибок с Sentry

## Описание

Criminal Bluff - это Telegram Mini App с мониторингом ошибок через Sentry. Приложение состоит из фронтенда (React) и бэкенда (Node.js с Express).

## Структура проекта

```
project/
├── backend/          # Бэкенд на Node.js + Express
│   ├── src/
│   │   ├── config/
│   │   │   ├── sentry.js   # Конфигурация Sentry для бэкенда
│   │   ├── instrument.js   # Экспорт Sentry для использования в приложении
│   └── ...
├── frontend/         # Фронтенд на React
│   ├── src/
│   │   ├── services/
│   │   │   ├── errorService.js  # Сервис для работы с Sentry
│   └── ...
└── ...
```

## Настройка Sentry

### Бэкенд

1. В файле `backend/.env` установите переменные окружения:

```
SENTRY_DSN=https://your-dsn-key@sentry.io/project-id
NODE_ENV=development|production
APP_NAME=your-app-name
```

2. Инициализация Sentry выполняется при старте приложения:

```javascript
const { initSentry } = require('./config/sentry');
initSentry(app); // передаем экземпляр Express
```

3. Для отправки ошибок используйте:

```javascript
const { captureException } = require('./config/sentry');

try {
  // ваш код
} catch (error) {
  captureException(error, {
    tags: { component: 'auth' },
    user: { id: userId }
  });
}
```

### Фронтенд

1. В файле `frontend/.env` установите:

```
VITE_SENTRY_DSN=https://your-dsn-key@sentry.io/project-id
VITE_NODE_ENV=development|production
VITE_APP_VERSION=1.0.0
```

2. Инициализируйте сервис ошибок в вашем приложении:

```javascript
import errorService from './services/errorService';

// В начале приложения
errorService.init(userObject);
```

3. Для отправки ошибок используйте:

```javascript
import errorService from './services/errorService';

try {
  // ваш код
} catch (error) {
  errorService.captureException(error, {
    tags: { action: 'login' }
  });
}
```

## Тестирование Sentry

Для проверки интеграции с Sentry используйте эндпоинт:

```
GET /debug-sentry
```

Этот эндпоинт доступен только в режиме разработки или если включен флаг `ENABLE_SENTRY_TEST_ROUTE=true`.

## Рекомендации по мониторингу

1. **Фильтрация ошибок**: Настройте фильтры в Sentry для игнорирования несущественных ошибок.
2. **Контекст ошибок**: Всегда добавляйте теги и дополнительную информацию для лучшей диагностики.
3. **Транзакции**: Используйте транзакции для мониторинга производительности критичных операций.

## Типы ошибок для отслеживания

- Ошибки API (statusCode, endpoint)
- Ошибки авторизации (authType, failureReason)
- Проблемы с Telegram API (method, params)
- Ошибки БД (operation, entity)
- Клиентские ошибки JavaScript (browser, component) 