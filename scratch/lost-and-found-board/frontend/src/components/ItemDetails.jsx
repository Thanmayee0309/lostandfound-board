import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

export default function ItemDetails({ itemId, currentUser, onViewItem, onBack, triggerToast, onClaimSuccess }) {
  const [item, setItem] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const [myClaim, setMyClaim] = useState(null);

  // Fetch Item details and AI Matches
  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const itemData = await api.getItem(itemId);
        if (!active) return;
        setItem(itemData);

        // Fetch AI matches if item is open
        if (itemData.status === 'open') {
          const matchesData = await api.getItemMatches(itemId);
          if (active) setMatches(matchesData);
        }

        // Fetch user's claim if status is claimed
        if (itemData.status === 'claimed' && currentUser) {
          try {
            const sentClaims = await api.getClaims('sent');
            const foundClaim = sentClaims.find(c => {
              const cItemId = c.itemId?._id || c.itemId;
              return cItemId === itemId && c.status === 'pending';
            });
            if (foundClaim && active) {
              setMyClaim(foundClaim);
            }
          } catch (cErr) {
            console.error('Failed to fetch user claims:', cErr);
          }
        }
      } catch (err) {
        triggerToast(err.message, 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      active = false;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [itemId]);

  // Initialize Map for Item Pin
  useEffect(() => {
    if (loading || !item || !item.latitude || !item.longitude) return;

    const L = window.L;
    if (L && mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([item.latitude, item.longitude], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      const pinColor = item.type === 'lost' ? '#dc3545' : '#28a745';
      const svgIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          background-color: ${pinColor}; 
          width: 15px; 
          height: 15px; 
          border-radius: 50%; 
          border: 3px solid #ffffff; 
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [15, 15],
        iconAnchor: [7.5, 7.5]
      });

      L.marker([item.latitude, item.longitude], { icon: svgIcon })
        .addTo(mapInstance.current)
        .bindPopup(`📍 ${item.locationText}`)
        .openPopup();
    }
  }, [loading, item]);

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!verificationAnswer) {
      triggerToast('Please provide a verification description.', 'error');
      return;
    }

    setSubmittingClaim(true);
    try {
      const claim = await api.submitClaim(item._id, verificationAnswer);
      triggerToast('Claim submitted successfully! Opening verification chat...', 'success');
      setShowClaimModal(false);
      
      if (onClaimSuccess && claim && claim._id) {
        onClaimSuccess(claim._id);
      } else {
        // Refresh item state
        const updatedItem = await api.getItem(item._id);
        setItem(updatedItem);
      }
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleResolveItem = async () => {
    if (window.confirm('Are you sure you want to mark this item as Returned/Resolved? This closes active claims.')) {
      try {
        const updated = await api.updateItemStatus(item._id, 'resolved');
        setItem(updated);
        triggerToast('Item marked as Resolved.', 'success');
      } catch (err) {
        triggerToast(err.message, 'error');
      }
    }
  };

  const handleDeleteItem = async () => {
    if (window.confirm('Are you sure you want to delete this listing permanently?')) {
      try {
        await api.deleteItem(item._id);
        triggerToast('Listing deleted successfully.', 'success');
        onBack();
      } catch (err) {
        triggerToast(err.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading item details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Item not found.</p>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const isOwner = currentUser && item.userId && (currentUser._id === (item.userId._id || item.userId));
  const isAdmin = currentUser && currentUser.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Back Header */}
      <div>
        <button onClick={onBack} className="btn btn-secondary">
          ⬅ Back to Dashboard
        </button>
      </div>

      <div className="item-details-layout">
        
        {/* Left Side: Details & Image */}
        <div className="item-details-main glass-card">
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span className={`badge-tag tag-${item.type}`} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'inline-block' }}>
                {item.type}
              </span>
              <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{item.title}</h1>
            </div>
            
            <span className={`status-pill status-${item.status}`}>
              Status: {item.status === 'claimed' ? 'Claim Pending' : item.status}
            </span>
          </div>

          <div className="item-details-meta">
            <span className="meta-chip">📁 {item.category}</span>
            <span className="meta-chip">📅 {new Date(item.date).toLocaleDateString()}</span>
            <span className="meta-chip">👤 Posted by: {item.userId?.username || 'Unknown'}</span>
          </div>

          {item.imageUrl && (
            <div className="item-details-image">
<img src={`https://lostandfound-boardkmt.onrender.com${item.imageUrl}`} alt={item.title} />            </div>
          )}

          <div>
            <h3 className="detail-section-title">Item Description</h3>
            <p style={{ whiteSpace: 'pre-line', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              {item.description}
            </p>
          </div>

          <div>
            <h3 className="detail-section-title">📍 Location Pin</h3>
            <p style={{ marginBottom: '1rem', fontWeight: 500 }}>{item.locationText}</p>
            
            {item.latitude && item.longitude ? (
              <div style={{ height: '250px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 10 }}></div>
              </div>
            ) : (
              <p style={{ fontStyle: 'italic', opacity: 0.6 }}>No GPS coordinates pinned on map.</p>
            )}
          </div>

          {/* Moderate Actions */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
            {/* Owner action */}
            {isOwner && item.status !== 'resolved' && (
              <button onClick={handleResolveItem} className="btn btn-primary">
                ✔ Mark Returned/Resolved
              </button>
            )}

            {/* Deletion (Owner/Admin) */}
            {(isOwner || isAdmin) && (
              <button onClick={handleDeleteItem} className="btn btn-danger">
                🗑 Delete Post
              </button>
            )}

            {/* Non-owner: Submit claim */}
            {!isOwner && item.status === 'open' && (
              <button onClick={() => setShowClaimModal(true)} className="btn btn-primary">
                🙋‍♀️ Claim Item
              </button>
            )}
            
            {!isOwner && item.status === 'claimed' && myClaim && (
              <button onClick={() => onClaimSuccess(myClaim._id)} className="btn btn-primary">
                💬 Open Verification Chat
              </button>
            )}

            {!isOwner && item.status === 'claimed' && !myClaim && (
              <button disabled className="btn btn-secondary">
                ⏳ Claim Pending Review
              </button>
            )}
          </div>
        </div>

        {/* Right Side: AI Match Suggestions */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🤖 AI Match Suggestions
          </h2>
          
          {item.status !== 'open' ? (
            <p style={{ fontStyle: 'italic', opacity: 0.6 }}>
              Suggestions are only active for Open posts.
            </p>
          ) : matches.length === 0 ? (
            <p style={{ fontStyle: 'italic', opacity: 0.6 }}>
              AI has scanned the board and found no potential matches for this listing yet.
            </p>
          ) : (
            <div className="matches-panel">
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Keyword overlaps matching this post with listings of the opposite type:
              </p>
              
              {matches.map(match => (
                <div 
                  key={match.item._id} 
                  className="match-card"
                  onClick={() => onViewItem(match.item._id)}
                >
                  <div className="match-score">
                    {Math.round(match.score * 100)}
                    <span>Match</span>
                  </div>
                  
                  <div className="match-details">
                    <h4 className="match-title">{match.item.title}</h4>
                    <div className="match-meta">
                      <span>📍 {match.item.locationText}</span>
                      <br />
                      <span>📅 {new Date(match.item.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Claim Modal Overlay */}
      {showClaimModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowClaimModal(false)}>
              ×
            </button>
            <h3 className="modal-title">🙋‍♀️ Claim Item Verification</h3>
            
            <form onSubmit={handleClaimSubmit}>
              <div className="form-group">
                <label style={{ lineHeight: 1.4, marginBottom: '0.75rem' }}>
                  To prevent fraudulent claims, please describe unique features or matching details of the item (e.g. customized attachments, serial codes, brand name, specific scratches, or bag contents).
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Describe details here..."
                  value={verificationAnswer}
                  onChange={(e) => setVerificationAnswer(e.target.value)}
                  required
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowClaimModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={submittingClaim}
                >
                  {submittingClaim ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
