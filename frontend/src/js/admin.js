document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sidebar = document.querySelector('.admin-sidebar');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const navLinks = document.querySelectorAll('.admin-nav-link');
  const contentSections = document.querySelectorAll('.admin-content-section');
  const userManagementSection = document.getElementById('user-management');
  const gameStatsSection = document.getElementById('game-stats');
  const settingsSection = document.getElementById('settings');
  const userSearchInput = document.getElementById('user-search');
  const userTable = document.querySelector('.admin-table tbody');
  const notificationContainer = document.querySelector('.admin-notifications');
  
  // Toggle sidebar
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      document.querySelector('.admin-content').classList.toggle('expanded');
    });
  }
  
  // Navigation handling
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Add active class to clicked link
      link.classList.add('active');
      
      // Hide all content sections
      contentSections.forEach(section => {
        section.classList.remove('active');
      });
      
      // Show target section
      const targetId = link.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        
        // Load section-specific data
        if (targetId === 'user-management') {
          loadUsers();
        } else if (targetId === 'game-stats') {
          loadGameStats();
        }
      }
    });
  });
  
  // User search functionality
  if (userSearchInput) {
    userSearchInput.addEventListener('input', debounce(function() {
      const searchTerm = this.value.toLowerCase().trim();
      filterUsers(searchTerm);
    }, 300));
  }
  
  // API functions
  async function loadUsers(page = 1, limit = 20) {
    try {
      showLoader(userManagementSection);
      const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      renderUsers(data.users);
      hideLoader(userManagementSection);
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Error loading users. Please try again.', 'error');
      hideLoader(userManagementSection);
    }
  }
  
  async function loadGameStats() {
    try {
      showLoader(gameStatsSection);
      const response = await fetch('/api/admin/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch game statistics');
      }
      
      const data = await response.json();
      renderGameStats(data);
      hideLoader(gameStatsSection);
    } catch (error) {
      console.error('Error loading game stats:', error);
      showNotification('Error loading game statistics. Please try again.', 'error');
      hideLoader(gameStatsSection);
    }
  }
  
  async function updateUserStatus(userId, status) {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user status');
      }
      
      showNotification(`User status updated successfully to ${status}`, 'success');
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      showNotification('Error updating user status. Please try again.', 'error');
      return false;
    }
  }
  
  // Render functions
  function renderUsers(users) {
    if (!userTable) return;
    
    userTable.innerHTML = '';
    
    if (users.length === 0) {
      userTable.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">No users found</td>
        </tr>
      `;
      return;
    }
    
    users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.totalScore || 0}</td>
        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
        <td>${user.status}</td>
        <td>
          <div class="admin-action-buttons">
            <button class="admin-btn-outline admin-btn-sm view-user" data-id="${user._id}">View</button>
            ${user.status === 'active' 
              ? `<button class="admin-btn-danger admin-btn-sm ban-user" data-id="${user._id}">Ban</button>`
              : `<button class="admin-btn-success admin-btn-sm unban-user" data-id="${user._id}">Unban</button>`
            }
          </div>
        </td>
      `;
      
      userTable.appendChild(row);
    });
    
    // Add event listeners for action buttons
    document.querySelectorAll('.view-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-id');
        viewUserDetails(userId);
      });
    });
    
    document.querySelectorAll('.ban-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to ban this user?')) {
          const success = await updateUserStatus(userId, 'banned');
          if (success) loadUsers();
        }
      });
    });
    
    document.querySelectorAll('.unban-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to unban this user?')) {
          const success = await updateUserStatus(userId, 'active');
          if (success) loadUsers();
        }
      });
    });
  }
  
  function renderGameStats(data) {
    if (!gameStatsSection) return;
    
    const statsContainer = gameStatsSection.querySelector('.admin-stats-container');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
      <div class="admin-stat-card">
        <h3>Total Games</h3>
        <div class="admin-stat-value">${data.totalGames || 0}</div>
      </div>
      <div class="admin-stat-card">
        <h3>Active Users</h3>
        <div class="admin-stat-value">${data.activeUsers || 0}</div>
      </div>
      <div class="admin-stat-card">
        <h3>Games Today</h3>
        <div class="admin-stat-value">${data.gamesToday || 0}</div>
      </div>
      <div class="admin-stat-card">
        <h3>Average Score</h3>
        <div class="admin-stat-value">${data.averageScore?.toFixed(1) || 0}</div>
      </div>
    `;
    
    // Render charts if Chart.js is available
    if (window.Chart && data.weeklyStats) {
      renderWeeklyActivityChart(data.weeklyStats);
    }
  }
  
  function renderWeeklyActivityChart(weeklyData) {
    const chartCanvas = document.getElementById('weekly-activity-chart');
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeklyData.map(item => item.day),
        datasets: [{
          label: 'Games Played',
          data: weeklyData.map(item => item.count),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Weekly Game Activity'
          }
        }
      }
    });
  }
  
  // Helper functions
  function filterUsers(searchTerm) {
    const rows = userTable.querySelectorAll('tr');
    
    rows.forEach(row => {
      const username = row.querySelector('td:first-child')?.textContent.toLowerCase() || '';
      const email = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
      
      if (username.includes(searchTerm) || email.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
  
  async function viewUserDetails(userId) {
    try {
      showLoader(userManagementSection);
      const response = await fetch(`/api/admin/users/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }
      
      const user = await response.json();
      
      // Create modal with user details
      const modal = document.createElement('div');
      modal.className = 'admin-modal';
      modal.innerHTML = `
        <div class="admin-modal-content">
          <div class="admin-modal-header">
            <h2>User Details: ${user.username}</h2>
            <button class="admin-modal-close">&times;</button>
          </div>
          <div class="admin-modal-body">
            <div class="admin-user-profile">
              <div class="admin-profile-section">
                <h3>Basic Information</h3>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Status:</strong> ${user.status}</p>
                <p><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
              </div>
              
              <div class="admin-profile-section">
                <h3>Game Statistics</h3>
                <p><strong>Total Score:</strong> ${user.totalScore || 0}</p>
                <p><strong>Games Played:</strong> ${user.gamesPlayed || 0}</p>
                <p><strong>Average Score:</strong> ${user.averageScore || 0}</p>
              </div>
              
              <div class="admin-profile-section">
                <h3>Actions</h3>
                <div class="admin-action-buttons">
                  ${user.status === 'active' 
                    ? `<button class="admin-btn-danger modal-ban-user" data-id="${user._id}">Ban User</button>`
                    : `<button class="admin-btn-success modal-unban-user" data-id="${user._id}">Unban User</button>`
                  }
                  <button class="admin-btn-outline modal-reset-password" data-id="${user._id}">Reset Password</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Add event listeners for modal actions
      const closeBtn = modal.querySelector('.admin-modal-close');
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
      
      const banBtn = modal.querySelector('.modal-ban-user');
      if (banBtn) {
        banBtn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to ban this user?')) {
            const success = await updateUserStatus(userId, 'banned');
            if (success) {
              document.body.removeChild(modal);
              loadUsers();
            }
          }
        });
      }
      
      const unbanBtn = modal.querySelector('.modal-unban-user');
      if (unbanBtn) {
        unbanBtn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to unban this user?')) {
            const success = await updateUserStatus(userId, 'active');
            if (success) {
              document.body.removeChild(modal);
              loadUsers();
            }
          }
        });
      }
      
      const resetPasswordBtn = modal.querySelector('.modal-reset-password');
      if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async () => {
          if (confirm('Are you sure you want to reset this user\'s password?')) {
            // Implement password reset functionality
            await resetUserPassword(userId);
          }
        });
      }
      
      hideLoader(userManagementSection);
    } catch (error) {
      console.error('Error fetching user details:', error);
      showNotification('Error fetching user details. Please try again.', 'error');
      hideLoader(userManagementSection);
    }
  }
  
  async function resetUserPassword(userId) {
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset password');
      }
      
      const result = await response.json();
      showNotification('Password reset email sent successfully', 'success');
    } catch (error) {
      console.error('Error resetting password:', error);
      showNotification('Error resetting password. Please try again.', 'error');
    }
  }
  
  function showLoader(container) {
    if (!container) return;
    
    const loader = document.createElement('div');
    loader.className = 'admin-loader';
    loader.innerHTML = '<div class="admin-spinner"></div>';
    container.appendChild(loader);
  }
  
  function hideLoader(container) {
    if (!container) return;
    
    const loader = container.querySelector('.admin-loader');
    if (loader) {
      container.removeChild(loader);
    }
  }
  
  function showNotification(message, type = 'info') {
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `admin-notification ${type}`;
    notification.innerHTML = `
      <div class="admin-notification-content">
        <p>${message}</p>
      </div>
      <button class="admin-notification-close">&times;</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode === notificationContainer) {
        notificationContainer.removeChild(notification);
      }
    }, 5000);
    
    // Add close button functionality
    const closeBtn = notification.querySelector('.admin-notification-close');
    closeBtn.addEventListener('click', () => {
      notificationContainer.removeChild(notification);
    });
  }
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Initialize default view
  if (navLinks.length > 0) {
    navLinks[0].click();
  }
}); 