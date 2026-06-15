import React, { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PostItem from './components/PostItem';
import ItemDetails from './components/ItemDetails';
import ClaimModerator from './components/ClaimModerator';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';
import { api } from './utils/api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeItemId, setActiveItemId] = useState(null);
  const [selectedClaimId, setSelectedClaimId] = useState(null);
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  // Trigger Toast Notification
  const triggerToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync Theme with body class
  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load User details on start if token exists
  useEffect(() => {
    if (token) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // Fetch fresh profile
        api.getMe()
          .then(data => setUser(data))
          .catch(() => handleLogout());
      }
    }
  }, [token]);

  // Fetch Notifications periodically if logged in
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const list = await api.getNotifications();
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000); // 20s poll
    return () => clearInterval(interval);
  }, [token]);

  const handleLoginSuccess = (loginUser, userToken) => {
    setToken(userToken);
    setUser(loginUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setActiveItemId(null);
    setActiveTab('dashboard');
    triggerToast('Logged out successfully.', 'success');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleNotificationClick = async (notif) => {
    try {
      await api.markNotificationRead(notif._id);
      fetchNotifications();
      
      // Navigate to item details
      if (notif.relatedId) {
        // Depending on type, it might relate to claim or match
        if (notif.type === 'match') {
          setActiveItemId(notif.relatedId);
          setActiveTab('dashboard');
        } else if (notif.type === 'claim') {
          setSelectedClaimId(notif.relatedId);
          setActiveTab('claims');
        }
      }
      setShowNotifications(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      fetchNotifications();
      triggerToast('All notifications marked as read.', 'success');
    } catch (err) {
      triggerToast(err.message, 'error');
    }
  };

  const handleViewItem = (id) => {
    setActiveItemId(id);
    setActiveTab('dashboard'); // detail page resides within dashboard panel
  };

  const handlePostSuccess = () => {
    setActiveTab('dashboard');
    setActiveItemId(null);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!token || !user) {
    return (
      <div className="app-container">
        <Login onLoginSuccess={handleLoginSuccess} triggerToast={triggerToast} />
        {toast && (
          <div className="toast" style={toast.type === 'error' ? { background: '#dc3545', color: '#ffffff' } : { background: 'var(--primary)', color: '#ffffff' }}>
            <span>{toast.type === 'error' ? '❌' : '✔'}</span>
            <span>{toast.text}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* Navigation Header */}
      <nav className="navbar">
        <a href="#" className="nav-brand" onClick={() => { setActiveTab('dashboard'); setActiveItemId(null); }}>
          <div className="nav-logo-icon">🤝</div>
          <span>Lost & Found</span>
        </a>

        {/* Tab Controls */}
        <div className="nav-tabs">
          <button 
            onClick={() => { setActiveTab('dashboard'); setActiveItemId(null); }} 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            🗺 Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('post-item')} 
            className={`tab-btn ${activeTab === 'post-item' ? 'active' : ''}`}
          >
            📢 Post Item
          </button>
          
          <button 
            onClick={() => setActiveTab('claims')} 
            className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
          >
            🤝 Claims Moderation
          </button>

          {user.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('admin')} 
              className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            >
              🛡 Admin Board
            </button>
          )}
        </div>

        {/* User Actions */}
        <div className="nav-actions">
          
          {/* Theme Switcher */}
          <button 
            onClick={toggleTheme} 
            className="icon-btn theme-toggle" 
            title="Toggle Theme"
          ></button>

          {/* Notifications Icon Bell */}
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className="icon-btn" 
            title="Notifications"
          >
            🔔
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {/* User Profile Pill */}
          <div className="user-pill" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('profile')}>
            <div className="avatar">
              {user.username ? user.username[0].toUpperCase() : 'U'}
            </div>
            <span>{user.username}</span>
          </div>

        </div>

        {/* Notifications Dropdown Drawer */}
        {showNotifications && (
          <div className="notifications-dropdown">
            <div className="notif-header">
              <span>Notifications inbox</span>
              {unreadCount > 0 && (
                <button className="notif-clear-btn" onClick={handleMarkAllNotificationsRead}>
                  Mark all read
                </button>
              )}
            </div>

            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">No notifications yet.</div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif._id} 
                    className={`notif-item ${notif.read ? '' : 'unread'}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="notif-msg">{notif.message}</div>
                    <div className="notif-date">
                      {new Date(notif.createdAt).toLocaleDateString()} at{' '}
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main Workspace Layout */}
      <main className="main-content">
        
        {/* Flyer Banner Inspired by Flyer Brochure layout */}
        {activeTab === 'dashboard' && !activeItemId && (
          <div className="flyer-banner">
            <div>
           <div className="flyer-meta"> Vardhaman College Of Engineering</div>
              <h1 className="flyer-title">Lost & Found Board</h1>
              <div className="flyer-subtitle">
                Reuniting students with their lost belongings through a smart campus board.
              </div>
            </div>
           
          </div>
        )}

        {/* Dynamic routing renderer */}
        {activeTab === 'dashboard' ? (
          activeItemId ? (
            <ItemDetails 
              itemId={activeItemId} 
              currentUser={user} 
              onViewItem={handleViewItem}
              onBack={() => setActiveItemId(null)} 
              triggerToast={triggerToast}
              onClaimSuccess={(claimId) => {
                setSelectedClaimId(claimId);
                setActiveTab('claims');
                setActiveItemId(null);
              }}
            />
          ) : (
            <Dashboard 
              onViewItem={handleViewItem} 
              triggerToast={triggerToast}
            />
          )
        ) : activeTab === 'post-item' ? (
          <PostItem 
            onPostSuccess={handlePostSuccess} 
            triggerToast={triggerToast}
          />
        ) : activeTab === 'claims' ? (
          <ClaimModerator 
            triggerToast={triggerToast} 
            onViewItem={handleViewItem}
            selectedClaimId={selectedClaimId}
            setSelectedClaimId={setSelectedClaimId}
          />
        ) : activeTab === 'profile' ? (
          <Profile 
            currentUser={user} 
            onLogout={handleLogout} 
            onViewItem={handleViewItem}
            triggerToast={triggerToast}
          />
        ) : activeTab === 'admin' ? (
          <AdminPanel 
            triggerToast={triggerToast}
          />
        ) : null}

      </main>

      {/* Slide-Up Status Toasts */}
      {toast && (
        <div className="toast" style={toast.type === 'error' ? { background: '#dc3545', color: '#ffffff' } : { background: 'var(--primary)', color: '#ffffff' }}>
          <span>{toast.type === 'error' ? '❌' : '✔'}</span>
          <span>{toast.text}</span>
        </div>
      )}

    </div>
  );
}
