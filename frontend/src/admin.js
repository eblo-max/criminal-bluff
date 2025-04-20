// Admin Panel JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    setupNavigation();
    
    // Modal handling
    setupModals();
    
    // Form handling
    setupForms();
    
    // Fetch data for dashboard
    loadDashboardData();
    
    // Load initial data for sections
    loadStoriesData();
    loadUsersData();
    loadStatsData();
});

// Navigation setup
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get target section
            const targetId = this.getAttribute('data-target');
            
            // Remove active class from all links and sections
            navLinks.forEach(link => link.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked link and target section
            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    // Set dashboard as active by default
    document.querySelector('.nav-link[data-target="dashboard"]').classList.add('active');
    document.getElementById('dashboard').classList.add('active');
}

// Modal setup
function setupModals() {
    // Open modals
    const modalTriggers = document.querySelectorAll('[data-modal]');
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function() {
            const modalId = this.getAttribute('data-modal');
            const modal = document.getElementById(modalId);
            modal.classList.add('show');
            
            // If this has a data-id attribute, it's for editing an existing item
            if (this.hasAttribute('data-id')) {
                const itemId = this.getAttribute('data-id');
                loadItemForEdit(modalId, itemId);
            }
        });
    });
    
    // Close modals
    const closeBtns = document.querySelectorAll('.close-btn, .cancel-btn');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.classList.remove('show');
            
            // Reset form if exists
            const form = modal.querySelector('form');
            if (form) form.reset();
        });
    });
    
    // Close when clicking outside modal content
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('show');
                
                // Reset form if exists
                const form = this.querySelector('form');
                if (form) form.reset();
            }
        });
    });
}

// Form setup
function setupForms() {
    // Add Story Form
    const addStoryForm = document.getElementById('add-story-form');
    if (addStoryForm) {
        addStoryForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const storyData = {
                title: formData.get('title'),
                category: formData.get('category'),
                difficulty: formData.get('difficulty'),
                content: formData.get('content'),
                isActive: formData.get('is_active') === 'on'
            };
            
            // If editing (has data-id), update story
            if (this.hasAttribute('data-id')) {
                const storyId = this.getAttribute('data-id');
                updateStory(storyId, storyData);
            } else {
                // Otherwise create new story
                createStory(storyData);
            }
            
            // Close modal
            document.getElementById('add-story-modal').classList.remove('show');
            this.reset();
        });
    }
    
    // Filter forms
    setupFilters();
}

// Setup filters for lists
function setupFilters() {
    const storyFilters = document.getElementById('story-filters');
    if (storyFilters) {
        storyFilters.addEventListener('submit', function(e) {
            e.preventDefault();
            loadStoriesData(new FormData(this));
        });
    }
    
    const userFilters = document.getElementById('user-filters');
    if (userFilters) {
        userFilters.addEventListener('submit', function(e) {
            e.preventDefault();
            loadUsersData(new FormData(this));
        });
    }
}

// Stats tabs
function setupStatsTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.stats-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and target content
            this.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// API calls
async function fetchAPI(endpoint, options = {}) {
    try {
        const baseUrl = '/api'; // Adjust based on your API URL
        const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('Ошибка при загрузке данных', 'error');
        return null;
    }
}

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('admin_token') || '';
}

// Dashboard data
async function loadDashboardData() {
    const dashboardData = await fetchAPI('/admin/dashboard');
    if (!dashboardData) return;
    
    // Update stats cards
    updateStatsCards(dashboardData.stats);
    
    // Update recent games
    updateRecentList('recent-games-list', dashboardData.recentGames, renderGameItem);
    
    // Update recent users
    updateRecentList('recent-users-list', dashboardData.recentUsers, renderUserItem);
}

// Update stats cards with data
function updateStatsCards(stats) {
    if (!stats) return;
    
    // Update each stat card
    if (stats.totalUsers) {
        document.getElementById('total-users-value').textContent = stats.totalUsers;
    }
    
    if (stats.activeUsers) {
        document.getElementById('active-users-value').textContent = stats.activeUsers;
    }
    
    if (stats.totalGames) {
        document.getElementById('total-games-value').textContent = stats.totalGames;
    }
    
    if (stats.averageScore) {
        document.getElementById('average-score-value').textContent = stats.averageScore;
    }
}

// Update a list with data
function updateRecentList(listId, items, renderFunction) {
    const list = document.getElementById(listId);
    if (!list || !items) return;
    
    // Clear existing items
    list.innerHTML = '';
    
    // Add new items
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'recent-item';
        itemElement.innerHTML = renderFunction(item);
        list.appendChild(itemElement);
    });
}

// Render a game item
function renderGameItem(game) {
    return `
        <div class="game-info">
            <div class="game-user">${game.userName}</div>
            <div class="game-details">
                <span class="game-score">Счет: ${game.score}</span>
                <span class="game-date">${formatDate(game.date)}</span>
            </div>
        </div>
    `;
}

// Render a user item
function renderUserItem(user) {
    return `
        <div class="user-info">
            <div class="user-name">${user.name}</div>
            <div class="user-details">
                <span class="user-email">${user.email}</span>
                <span class="user-date">Регистрация: ${formatDate(user.registrationDate)}</span>
            </div>
        </div>
    `;
}

// Stories data
async function loadStoriesData(filters = null) {
    let endpoint = '/admin/stories';
    
    // Add query params if filters provided
    if (filters) {
        const params = new URLSearchParams();
        if (filters.get('category')) params.append('category', filters.get('category'));
        if (filters.get('difficulty')) params.append('difficulty', filters.get('difficulty'));
        if (filters.get('status')) params.append('status', filters.get('status'));
        if (filters.get('search')) params.append('search', filters.get('search'));
        
        endpoint += `?${params.toString()}`;
    }
    
    const storiesData = await fetchAPI(endpoint);
    if (!storiesData) return;
    
    // Render stories list
    renderStoriesList(storiesData.stories);
    
    // Update pagination
    updatePagination('stories-pagination', storiesData.pagination, loadStoriesPage);
}

// Render stories list
function renderStoriesList(stories) {
    const list = document.querySelector('.stories-list');
    if (!list || !stories) return;
    
    // Clear existing items
    list.innerHTML = '';
    
    // Add story items
    stories.forEach(story => {
        const storyElement = document.createElement('div');
        storyElement.className = 'list-item';
        storyElement.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-title">${story.title}</div>
                <div class="list-item-subtitle">
                    Категория: ${story.category} | Сложность: ${story.difficulty} | 
                    Статус: ${story.isActive ? 'Активна' : 'Неактивна'}
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-secondary" data-modal="add-story-modal" data-id="${story._id}">
                    Редактировать
                </button>
                <button class="btn btn-danger" onclick="confirmDeleteStory('${story._id}')">
                    Удалить
                </button>
            </div>
        `;
        list.appendChild(storyElement);
    });
    
    // Re-setup modal triggers for new buttons
    setupModals();
}

// Load a specific page of stories
async function loadStoriesPage(page) {
    const filters = new FormData(document.getElementById('story-filters'));
    filters.append('page', page);
    loadStoriesData(filters);
}

// Users data
async function loadUsersData(filters = null) {
    let endpoint = '/admin/users';
    
    // Add query params if filters provided
    if (filters) {
        const params = new URLSearchParams();
        if (filters.get('role')) params.append('role', filters.get('role'));
        if (filters.get('status')) params.append('status', filters.get('status'));
        if (filters.get('search')) params.append('search', filters.get('search'));
        
        endpoint += `?${params.toString()}`;
    }
    
    const usersData = await fetchAPI(endpoint);
    if (!usersData) return;
    
    // Render users list
    renderUsersList(usersData.users);
    
    // Update pagination
    updatePagination('users-pagination', usersData.pagination, loadUsersPage);
}

// Render users list
function renderUsersList(users) {
    const list = document.querySelector('.users-list');
    if (!list || !users) return;
    
    // Clear existing items
    list.innerHTML = '';
    
    // Add user items
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'list-item';
        userElement.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-title">${user.name}</div>
                <div class="list-item-subtitle">
                    Email: ${user.email} | Роль: ${user.role} | 
                    Регистрация: ${formatDate(user.registrationDate)}
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-secondary" data-modal="user-details-modal" data-id="${user._id}">
                    Подробнее
                </button>
            </div>
        `;
        list.appendChild(userElement);
    });
    
    // Re-setup modal triggers for new buttons
    setupModals();
}

// Load a specific page of users
async function loadUsersPage(page) {
    const filters = new FormData(document.getElementById('user-filters'));
    filters.append('page', page);
    loadUsersData(filters);
}

// Load user details for modal
async function loadItemForEdit(modalId, itemId) {
    if (modalId === 'add-story-modal') {
        // Load story for editing
        const story = await fetchAPI(`/admin/stories/${itemId}`);
        if (!story) return;
        
        const form = document.getElementById('add-story-form');
        form.setAttribute('data-id', itemId);
        form.querySelector('[name="title"]').value = story.title;
        form.querySelector('[name="category"]').value = story.category;
        form.querySelector('[name="difficulty"]').value = story.difficulty;
        form.querySelector('[name="content"]').value = story.content;
        form.querySelector('[name="is_active"]').checked = story.isActive;
        
        // Update modal title
        document.querySelector('#add-story-modal .modal-title').textContent = 'Редактировать историю';
    } else if (modalId === 'user-details-modal') {
        // Load user details
        const user = await fetchAPI(`/admin/users/${itemId}`);
        if (!user) return;
        
        // Update user details in modal
        updateUserDetailsModal(user);
    }
}

// Update user details modal content
function updateUserDetailsModal(user) {
    const modal = document.getElementById('user-details-modal');
    
    // Update user info
    modal.querySelector('.user-name-value').textContent = user.name;
    modal.querySelector('.user-email-value').textContent = user.email;
    modal.querySelector('.user-role-value').textContent = user.role;
    modal.querySelector('.user-registration-value').textContent = formatDate(user.registrationDate);
    modal.querySelector('.user-last-login-value').textContent = formatDate(user.lastLogin);
    modal.querySelector('.user-games-count-value').textContent = user.gamesCount;
    modal.querySelector('.user-avg-score-value').textContent = user.averageScore;
    
    // Update user games list
    const gamesList = modal.querySelector('.user-games-list');
    gamesList.innerHTML = '';
    
    if (user.recentGames && user.recentGames.length > 0) {
        user.recentGames.forEach(game => {
            const gameItem = document.createElement('div');
            gameItem.className = 'recent-item';
            gameItem.innerHTML = renderGameItem(game);
            gamesList.appendChild(gameItem);
        });
    } else {
        gamesList.innerHTML = '<div class="no-data">Нет данных об играх</div>';
    }
}

// Stats data
async function loadStatsData() {
    const statsData = await fetchAPI('/admin/stats');
    if (!statsData) return;
    
    // Setup tabs
    setupStatsTabs();
    
    // Render different stats sections
    renderUserStats(statsData.userStats);
    renderGameStats(statsData.gameStats);
    renderAchievementStats(statsData.achievementStats);
}

// Render user statistics
function renderUserStats(userStats) {
    if (!userStats) return;
    
    // TODO: Implement charts or visualizations using chart.js or similar library
    // For now, just show some text data
    const userStatsContainer = document.getElementById('user-stats');
    
    userStatsContainer.innerHTML = `
        <div class="stats-summary">
            <div class="stats-item">
                <div class="stats-item-label">Всего пользователей</div>
                <div class="stats-item-value">${userStats.totalUsers}</div>
            </div>
            <div class="stats-item">
                <div class="stats-item-label">Активных за неделю</div>
                <div class="stats-item-value">${userStats.weeklyActiveUsers}</div>
            </div>
            <div class="stats-item">
                <div class="stats-item-label">Новых за месяц</div>
                <div class="stats-item-value">${userStats.newMonthlyUsers}</div>
            </div>
        </div>
        <div class="stats-chart">
            <h3>Динамика регистраций</h3>
            <div id="user-registrations-chart" class="chart-container">
                <!-- Chart will be rendered here by chart.js -->
                <p>График регистраций пользователей по времени</p>
            </div>
        </div>
    `;
}

// Render game statistics
function renderGameStats(gameStats) {
    if (!gameStats) return;
    
    const gameStatsContainer = document.getElementById('game-stats');
    
    gameStatsContainer.innerHTML = `
        <div class="stats-summary">
            <div class="stats-item">
                <div class="stats-item-label">Всего игр</div>
                <div class="stats-item-value">${gameStats.totalGames}</div>
            </div>
            <div class="stats-item">
                <div class="stats-item-label">Игр за неделю</div>
                <div class="stats-item-value">${gameStats.weeklyGames}</div>
            </div>
            <div class="stats-item">
                <div class="stats-item-label">Средний счет</div>
                <div class="stats-item-value">${gameStats.averageScore}</div>
            </div>
        </div>
        <div class="stats-chart">
            <h3>Активность игр</h3>
            <div id="game-activity-chart" class="chart-container">
                <!-- Chart will be rendered here by chart.js -->
                <p>График активности игр по времени</p>
            </div>
        </div>
    `;
}

// Render achievement statistics
function renderAchievementStats(achievementStats) {
    if (!achievementStats) return;
    
    const achievementStatsContainer = document.getElementById('achievement-stats');
    
    achievementStatsContainer.innerHTML = `
        <div class="stats-summary">
            <div class="stats-item">
                <div class="stats-item-label">Всего достижений получено</div>
                <div class="stats-item-value">${achievementStats.totalAwarded}</div>
            </div>
            <div class="stats-item">
                <div class="stats-item-label">Уникальных пользователей с достижениями</div>
                <div class="stats-item-value">${achievementStats.uniqueUsers}</div>
            </div>
        </div>
        <div class="stats-chart">
            <h3>Популярные достижения</h3>
            <div id="achievement-popularity-chart" class="chart-container">
                <!-- Chart will be rendered here by chart.js -->
                <p>График популярности различных достижений</p>
            </div>
        </div>
    `;
}

// Pagination utilities
function updatePagination(containerId, pagination, pageCallback) {
    const container = document.getElementById(containerId);
    if (!container || !pagination) return;
    
    container.innerHTML = '';
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn prev-btn';
    prevBtn.textContent = '←';
    prevBtn.disabled = pagination.currentPage === 1;
    prevBtn.addEventListener('click', () => pageCallback(pagination.currentPage - 1));
    container.appendChild(prevBtn);
    
    // Page buttons
    const startPage = Math.max(1, pagination.currentPage - 2);
    const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn page-btn ${i === pagination.currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => pageCallback(i));
        container.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn next-btn';
    nextBtn.textContent = '→';
    nextBtn.disabled = pagination.currentPage === pagination.totalPages;
    nextBtn.addEventListener('click', () => pageCallback(pagination.currentPage + 1));
    container.appendChild(nextBtn);
}

// Story CRUD operations
async function createStory(storyData) {
    const result = await fetchAPI('/admin/stories', {
        method: 'POST',
        body: JSON.stringify(storyData)
    });
    
    if (result) {
        showNotification('История успешно создана', 'success');
        loadStoriesData();
    }
}

async function updateStory(storyId, storyData) {
    const result = await fetchAPI(`/admin/stories/${storyId}`, {
        method: 'PUT',
        body: JSON.stringify(storyData)
    });
    
    if (result) {
        showNotification('История успешно обновлена', 'success');
        loadStoriesData();
    }
}

async function deleteStory(storyId) {
    const result = await fetchAPI(`/admin/stories/${storyId}`, {
        method: 'DELETE'
    });
    
    if (result) {
        showNotification('История успешно удалена', 'success');
        loadStoriesData();
    }
}

// Confirm story deletion
function confirmDeleteStory(storyId) {
    const modal = document.getElementById('confirm-modal');
    const confirmBtn = modal.querySelector('.confirm-btn');
    
    // Set up confirm button action
    confirmBtn.onclick = function() {
        deleteStory(storyId);
        modal.classList.remove('show');
    };
    
    // Show modal
    modal.classList.add('show');
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return 'Н/Д';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">${message}</div>
        <button class="notification-close">&times;</button>
    `;
    
    // Add to notifications container or create one if it doesn't exist
    let container = document.querySelector('.notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notifications-container';
        document.body.appendChild(container);
    }
    
    // Add notification to container
    container.appendChild(notification);
    
    // Add close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', function() {
        notification.remove();
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
} 