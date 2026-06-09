import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function AdminPanel({ triggerToast }) {
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all items (status all)
      const allItems = await api.getItems({ status: 'all' });
      setItems(allItems);

      // Fetch all claims (admins can see all)
      const allClaims = await api.getClaims('all');
      setClaims(allClaims);
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteItem = async (itemId) => {
    if (window.confirm('ADMIN OPERATION: Are you sure you want to delete this listing permanently?')) {
      try {
        await api.deleteItem(itemId);
        triggerToast('Item deleted by Admin.', 'success');
        fetchData(); // reload
      } catch (err) {
        triggerToast(err.message, 'error');
      }
    }
  };

  // Stats Calculations
  const totalItems = items.length;
  const lostCount = items.filter(i => i.type === 'lost').length;
  const foundCount = items.filter(i => i.type === 'found').length;
  const openCount = items.filter(i => i.status === 'open').length;
  const claimedCount = items.filter(i => i.status === 'claimed').length;
  const resolvedCount = items.filter(i => i.status === 'resolved').length;
  const totalClaims = claims.length;

  if (loading) return <p>Loading Admin Dashboard...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Stats Section */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.5rem' }}>📊 Campus Summary Statistics</h2>
        
        <div className="admin-summary-grid">
          <div className="stat-box">
            <div className="stat-val">{totalItems}</div>
            <div className="stat-lbl">Total Reports</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#dc3545' }}>{lostCount}</div>
            <div className="stat-lbl">Lost Items</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#28a745' }}>{foundCount}</div>
            <div className="stat-lbl">Found Items</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: 'var(--warning)' }}>{claimedCount}</div>
            <div className="stat-lbl">Pending Claims</div>
          </div>
        </div>

        <div className="admin-summary-grid" style={{ marginTop: '1rem' }}>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#6c757d' }}>{resolvedCount}</div>
            <div className="stat-lbl">Resolved (Returned)</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">{openCount}</div>
            <div className="stat-lbl">Active Board Listings</div>
          </div>
          <div className="stat-box">
            <div className="stat-val">{totalClaims}</div>
            <div className="stat-lbl">Total Claims Submitted</div>
          </div>
          <div className="stat-box">
            <div className="stat-val" style={{ color: '#14C27A' }}>
              {totalItems > 0 ? `${Math.round((resolvedCount / totalItems) * 100)}%` : '0%'}
            </div>
            <div className="stat-lbl">Recovery Rate</div>
          </div>
        </div>
      </div>

      {/* Moderation Section */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '1.5rem' }}>🛡 Admin Content Moderation</h2>
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Review and remove flagged, inappropriate, or duplicate posts on the campus board.
        </p>

        <div className="claims-table-container">
          <table className="claims-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Category</th>
                <th>Reporter</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.title}</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>📍 {item.locationText}</span>
                  </td>
                  <td>
                    <span className={`badge-tag tag-${item.type}`}>{item.type}</span>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.userId?.username || 'Unknown'}</td>
                  <td>{new Date(item.date).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-pill status-${item.status}`}>{item.status}</span>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDeleteItem(item._id)} 
                      className="btn btn-danger"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
