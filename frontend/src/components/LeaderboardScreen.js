/**
 * LeaderboardScreen Component
 * Отвечает за отображение таблицы лидеров
 */
class LeaderboardScreen {
  constructor(apiService, uiService) {
    this.apiService = apiService;
    this.uiService = uiService;
    this.container = document.getElementById('leaderboard-screen');
    this.leaderboardTable = this.container.querySelector('.leaderboard-table');
    this.tabButtons = this.container.querySelectorAll('.tab-btn');
    this.neighborsContainer = this.container.querySelector('.neighbors-container');
    this.paginationContainer = this.container.querySelector('.pagination');
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.currentPeriod = 'daily'; // по умолчанию показываем дневной рейтинг
  }

  /**
   * Инициализация экрана таблицы лидеров
   */
  async init() {
    this.bindEvents();
    await this.loadLeaderboard(this.currentPeriod);
  }

  /**
   * Загрузка данных таблицы лидеров
   * @param {String} period - Период таблицы лидеров (daily/weekly/all-time)
   * @param {Number} page - Номер страницы
   */
  async loadLeaderboard(period, page = 1) {
    try {
      this.uiService.showLoading();
      this.currentPeriod = period;
      this.currentPage = page;

      // Обновление активной вкладки
      this.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-period') === period);
      });

      // Получение данных таблицы лидеров
      const leaderboardData = await this.apiService.getLeaderboard(period, page, this.itemsPerPage);
      
      if (leaderboardData && leaderboardData.leaderboard) {
        this.renderLeaderboard(leaderboardData.leaderboard);
        this.renderPagination(leaderboardData.pagination);
        
        // Загрузка соседей текущего пользователя
        const neighbors = await this.apiService.getUserNeighbors(period);
        if (neighbors) {
          this.renderNeighbors(neighbors);
        }
      } else {
        this.leaderboardTable.innerHTML = '<tr><td colspan="4" class="text-center">Нет данных</td></tr>';
        this.neighborsContainer.style.display = 'none';
      }

      this.uiService.hideLoading();
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      this.uiService.hideLoading();
      this.uiService.showError('Не удалось загрузить таблицу лидеров');
    }
  }

  /**
   * Отрисовка таблицы лидеров
   * @param {Array} leaderboard - Массив данных таблицы лидеров
   */
  renderLeaderboard(leaderboard) {
    this.leaderboardTable.innerHTML = '';
    
    // Заголовок таблицы
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Ранг</th>
        <th>Игрок</th>
        <th>Счет</th>
        <th>Игры</th>
      </tr>
    `;
    this.leaderboardTable.appendChild(thead);
    
    // Тело таблицы
    const tbody = document.createElement('tbody');
    
    if (leaderboard.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Нет данных</td></tr>';
    } else {
      leaderboard.forEach(player => {
        const row = document.createElement('tr');
        
        // Выделение собственного результата
        if (player.isCurrentUser) {
          row.classList.add('current-user');
        }
        
        row.innerHTML = `
          <td class="rank">${player.rank}</td>
          <td class="username">
            ${player.photoUrl ? `<img src="${player.photoUrl}" class="avatar" alt="${player.username}">` : ''}
            <span>${player.username}</span>
          </td>
          <td class="score">${player.score}</td>
          <td class="games">${player.gamesPlayed || '-'}</td>
        `;
        
        tbody.appendChild(row);
      });
    }
    
    this.leaderboardTable.appendChild(tbody);
  }

  /**
   * Отрисовка пагинации
   * @param {Object} pagination - Данные пагинации
   */
  renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) {
      this.paginationContainer.style.display = 'none';
      return;
    }
    
    this.paginationContainer.style.display = 'flex';
    this.paginationContainer.innerHTML = '';
    
    // Кнопка "Предыдущая"
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn prev';
    prevBtn.disabled = pagination.currentPage === 1;
    prevBtn.textContent = '←';
    prevBtn.addEventListener('click', () => {
      if (pagination.currentPage > 1) {
        this.loadLeaderboard(this.currentPeriod, pagination.currentPage - 1);
      }
    });
    this.paginationContainer.appendChild(prevBtn);
    
    // Создаем номера страниц
    this.createPageNumbers(pagination);
    
    // Кнопка "Следующая"
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn next';
    nextBtn.disabled = pagination.currentPage === pagination.totalPages;
    nextBtn.textContent = '→';
    nextBtn.addEventListener('click', () => {
      if (pagination.currentPage < pagination.totalPages) {
        this.loadLeaderboard(this.currentPeriod, pagination.currentPage + 1);
      }
    });
    this.paginationContainer.appendChild(nextBtn);
  }

  /**
   * Создание номеров страниц для пагинации
   * @param {Object} pagination - Данные пагинации
   */
  createPageNumbers(pagination) {
    const { currentPage, totalPages } = pagination;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    // Добавляем кнопку для первой страницы
    if (startPage > 1) {
      this.addPageButton(1, currentPage);
      
      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        this.paginationContainer.appendChild(ellipsis);
      }
    }
    
    // Добавляем кнопки для страниц в диапазоне
    for (let i = startPage; i <= endPage; i++) {
      this.addPageButton(i, currentPage);
    }
    
    // Добавляем кнопку для последней страницы
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        this.paginationContainer.appendChild(ellipsis);
      }
      
      this.addPageButton(totalPages, currentPage);
    }
  }

  /**
   * Добавление кнопки страницы в пагинацию
   * @param {Number} pageNum - Номер страницы
   * @param {Number} currentPage - Текущая страница
   */
  addPageButton(pageNum, currentPage) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-btn page-num ${pageNum === currentPage ? 'active' : ''}`;
    pageBtn.textContent = pageNum;
    pageBtn.addEventListener('click', () => {
      if (pageNum !== currentPage) {
        this.loadLeaderboard(this.currentPeriod, pageNum);
      }
    });
    this.paginationContainer.appendChild(pageBtn);
  }

  /**
   * Отрисовка соседей текущего пользователя
   * @param {Object} neighbors - Данные о соседях пользователя
   */
  renderNeighbors(neighbors) {
    if (!neighbors || !neighbors.currentUser) {
      this.neighborsContainer.style.display = 'none';
      return;
    }
    
    this.neighborsContainer.style.display = 'block';
    const neighborsTable = this.neighborsContainer.querySelector('.neighbors-table');
    neighborsTable.innerHTML = '';
    
    // Создаем и добавляем строки для "соседей"
    if (neighbors.above && neighbors.above.length > 0) {
      neighbors.above.forEach(player => {
        this.addNeighborRow(neighborsTable, player);
      });
    }
    
    // Добавляем строку для текущего пользователя
    this.addNeighborRow(neighborsTable, neighbors.currentUser, true);
    
    // Добавляем строки для игроков ниже текущего пользователя
    if (neighbors.below && neighbors.below.length > 0) {
      neighbors.below.forEach(player => {
        this.addNeighborRow(neighborsTable, player);
      });
    }
  }

  /**
   * Добавление строки в таблицу соседей
   * @param {HTMLElement} table - DOM элемент таблицы
   * @param {Object} player - Данные игрока
   * @param {Boolean} isCurrentUser - Флаг текущего пользователя
   */
  addNeighborRow(table, player, isCurrentUser = false) {
    const row = document.createElement('tr');
    if (isCurrentUser) {
      row.classList.add('current-user');
    }
    
    row.innerHTML = `
      <td class="rank">${player.rank}</td>
      <td class="username">
        ${player.photoUrl ? `<img src="${player.photoUrl}" class="avatar" alt="${player.username}">` : ''}
        <span>${player.username}</span>
      </td>
      <td class="score">${player.score}</td>
      <td class="games">${player.gamesPlayed || '-'}</td>
    `;
    
    table.appendChild(row);
  }

  /**
   * Привязка обработчиков событий
   */
  bindEvents() {
    // Обработчики для вкладок периодов
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        this.loadLeaderboard(period);
      });
    });
  }
}

export default LeaderboardScreen; 