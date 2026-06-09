import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Profile({ currentUser, onLogout, onViewItem, triggerToast }) {
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyItems = async () => {
      setLoading(true);
      try {
        const allItems = await api.getItems({ status: 'all' });
        // Filter items posted by this user
        const filtered = allItems.filter(item => {
          const itemUserId = item.userId._id ? item.userId._id.toString() : item.userId.toString();
          return itemUserId === currentUser._id.toString();
        });
        setMyItems(filtered);
      } catch (err) {
        triggerToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchMyItems();
  }, [currentUser]);

  const totalPosted = myItems.length;
  const lostCount = myItems.filter(i => i.type === 'lost').length;
  const foundCount = myItems.filter(i => i.type === 'found').length;
  const resolvedCount = myItems.filter(i => i.status === 'resolved').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Profile summary card */}
      <div className="glass-card">
        <div className="profile-hero">
          <div className="profile-avatar-large">
            {currentUser.username ? currentUser.username[0].toUpperCase() : 'U'}
          </div>
          <div className="profile-info">
            <h2>{currentUser.username}</h2>
            <p>📧 {currentUser.email}</p>
            <p style={{ textTransform: 'capitalize', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.25rem' }}>
              Pill role: <span style={{ color: 'var(--primary)' }}>{currentUser.role}</span>
            </p>
          </div>
        </div>

        <h3 style={{ marginBottom: '1rem' }}>📈 Your Activity Statistics</h3>
        <div className="profile-stats">
          <div className="stat-box">
            <div className="stat-val">{totalPosted}</div>
            <div className="stat-lbl">Items Posted</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#dc3545' }}>{lostCount}</div>
            <div className="stat-lbl">Lost Filed</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#28a745' }}>{foundCount}</div>
            <div className="stat-lbl">Found Filed</div>
          </div>
        </div>

        <div className="profile-stats" style={{ marginTop: '1rem' }}>
          <div className="stat-box">
            <div className="stat-val" style={{ color: 'var(--primary)' }}>{resolvedCount}</div>
            <div className="stat-lbl">Resolved Cases</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">
              {totalPosted > 0 ? `${Math.round((resolvedCount / totalPosted) * 100)}%` : '0%'}
            </div>
            <div className="stat-lbl">Success Rate</div>
          </div>
          <div className="stat-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={onLogout} className="btn btn-danger btn-full" style={{ padding: '0.5rem 1rem' }}>
              🔒 Logout Session
            </button>
          </div>
        </div>
      </div>

      {/* Your Listings list */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1rem' }}>📋 Your Posted Listings</h3>
        
        {loading ? (
          <p>Loading your listings...</p>
        ) : myItems.length === 0 ? (
          <p style={{ fontStyle: 'italic', opacity: 0.6, padding: '1rem 0' }}>
            You haven't posted any items on the board yet.
          </p>
        ) : (
          <div className="claims-table-container">
            <table className="claims-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myItems.map(item => (
                  <tr key={item._id}>
                    <td>
                      <div 
                        onClick={() => onViewItem(item._id)} 
                        style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}
                      >
                        {item.title}
                      </div>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>📍 {item.locationText}</span>
                    </td>
                    <td>
                      <span className={`badge-tag tag-${item.type}`}>{item.type}</span>
                    </td>
                    <td>{item.category}</td>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
