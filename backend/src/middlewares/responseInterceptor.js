const responseInterceptor = (req, res, next) => {
  // Сохраняем оригинальную функцию json
  const originalJson = res.json;

  // Переопределяем метод json
  res.json = function(data) {
    // Если это ответ с ошибкой (статус >= 400)
    if (res.statusCode >= 400) {
      return originalJson.call(this, {
        success: false,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        ...data
      });
    }

    // Для успешных ответов
    return originalJson.call(this, {
      success: true,
      timestamp: new Date().toISOString(),
      data,
      // Добавляем пагинацию, если она есть
      ...(data.pagination && { 
        pagination: {
          total: data.pagination.total,
          page: data.pagination.page,
          limit: data.pagination.limit,
          pages: Math.ceil(data.pagination.total / data.pagination.limit)
        }
      })
    });
  };

  // Добавляем вспомогательные методы для стандартных ответов
  res.success = function(data, message = '') {
    return this.status(200).json({
      data,
      message
    });
  };

  res.created = function(data, message = 'Ресурс успешно создан') {
    return this.status(201).json({
      data,
      message
    });
  };

  res.noContent = function() {
    return this.status(204).end();
  };

  next();
};

module.exports = responseInterceptor; 