import React, { useState } from 'react';
import { api } from '../utils/api';

export default function Login({ onLoginSuccess, triggerToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !username)) {
      triggerToast('Please fill out all required fields.', 'error');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      triggerToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const data = await api.login(email, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({
          _id: data._id,
          username: data.username,
          email: data.email,
          role: data.role
        }));
        triggerToast(`Welcome back, ${data.username}!`, 'success');
        onLoginSuccess(data, data.token);
      } else {
        // Simple admin code check - if user types admin in username, make them admin (optional, let's just make role user)
        const role = email.toLowerCase().startsWith('admin@') ? 'admin' : 'user';
        const data = await api.register(username, email, password, role);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify({
          _id: data._id,
          username: data.username,
          email: data.email,
          role: data.role
        }));
        triggerToast(`Account created successfully! Welcome ${data.username}`, 'success');
        onLoginSuccess(data, data.token);
      }
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="nav-logo-icon" style={{ margin: '0 auto 1rem', width: '3rem', height: '3rem', fontSize: '1.4rem' }}>
            🤝
          </div>
          <h2>Lost & Found Board</h2>
          <p>Reuniting students with their lost belongings through a smart campus board.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="username">Full Name / Username *</label>
              <input
                type="text"
                id="username"
                className="form-control"
                placeholder="e.g. John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Campus Email Address *</label>
            <input
              type="email"
              id="email"
              className="form-control"
              placeholder="e.g. student@vardhaman.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              className="form-control"
              placeholder="Enter secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control"
                placeholder="Retype password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <div className="form-footer">
            {isLogin ? (
              <p>
                First time on the board?{' '}
                <span className="form-link" onClick={toggleAuthMode}>
                  Register here
                </span>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <span className="form-link" onClick={toggleAuthMode}>
                  Sign in instead
                </span>
              </p>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <p>💡 Tip: Campus emails starting with <strong>admin@</strong> are automatically logged in as Administrators.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
