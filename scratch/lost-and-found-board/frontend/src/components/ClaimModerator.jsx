import React, { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function ClaimModerator({ triggerToast, onViewItem }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimType, setClaimType] = useState('received'); // 'received' | 'sent'

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const data = await api.getClaims(claimType);
      setClaims(data);
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [claimType]);

  const handleModerate = async (claimId, newStatus) => {
    const actionText = newStatus === 'approved' ? 'approve' : 'decline';
    if (!window.confirm(`Are you sure you want to ${actionText} this claim?`)) {
      return;
    }

    try {
      await api.moderateClaim(claimId, newStatus);
      triggerToast(`Claim successfully ${newStatus}!`, 'success');
      fetchClaims(); // refresh list
    } catch (err) {
      triggerToast(err.message, 'error');
    }
  };

  return (
    <div className="glass-card">
      <h2 style={{ marginBottom: '1.5rem' }}>🤝 Claims Moderation Center</h2>

      {/* Claim Tab selectors */}
      <div className="type-filter-group" style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`type-filter-btn ${claimType === 'received' ? 'active' : ''}`}
          onClick={() => setClaimType('received')}
        >
          Claims Received (On Your Posts)
        </button>
        <button
          type="button"
          className={`type-filter-btn ${claimType === 'sent' ? 'active' : ''}`}
          onClick={() => setClaimType('sent')}
        >
          Claims Sent (Your Requests)
        </button>
      </div>

      {loading ? (
        <p>Loading claims data...</p>
      ) : claims.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
          <p>No claims found in this category.</p>
        </div>
      ) : (
        <div className="claims-table-container">
          <table className="claims-table">
            <thead>
              <tr>
                <th>Item Details</th>
                {claimType === 'received' ? <th>Claimant</th> : <th>Item Owner</th>}
                <th>Verification Answer</th>
                <th>Status</th>
                {claimType === 'received' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {claims.map(claim => {
                const item = claim.itemId || {};
                const claimant = claim.claimantId || {};
                const owner = claim.ownerId || {};

                return (
                  <tr key={claim._id}>
                    <td>
                      <div 
                        style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}
                        onClick={() => onViewItem(item._id)}
                      >
                        {item.title}
                      </div>
                      <span className={`badge-tag tag-${item.type}`} style={{ fontSize: '0.6rem' }}>
                        {item.type}
                      </span>
                    </td>
                    <td>
                      {claimType === 'received' ? (
                        <div>
                          <strong>{claimant.username}</strong>
                          <br />
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{claimant.email}</span>
                        </div>
                      ) : (
                        <div>
                          <strong>{owner.username}</strong>
                          <br />
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{owner.email}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px', fontSize: '0.9rem', wordBreak: 'break-word' }}>
                      {claim.verificationAnswer}
                    </td>
                    <td>
                      <span className={`status-pill status-${claim.status}`}>
                        {claim.status}
                      </span>
                    </td>
                    {claimType === 'received' && (
                      <td>
                        {claim.status === 'pending' ? (
                          <div className="actions-cell">
                            <button 
                              onClick={() => handleModerate(claim._id, 'approved')} 
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#e2f2e9', color: '#28a745' }}
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleModerate(claim._id, 'rejected')} 
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#fde8eb', color: '#dc3545' }}
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Moderated</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
