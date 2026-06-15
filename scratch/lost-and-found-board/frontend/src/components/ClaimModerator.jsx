import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

export default function ClaimModerator({ triggerToast, onViewItem, selectedClaimId, setSelectedClaimId }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimType, setClaimType] = useState('received'); // 'received' | 'sent'
  
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef(null);
  const chatPollRef = useRef(null);

  // Get current logged-in user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Fetch Claims list
  const fetchClaims = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getClaims(claimType);
      setClaims(data);
      
      // Auto-select first claim if selectedClaimId is not set or not in current list
      if (!silent && data.length > 0 && !selectedClaimId) {
        // If there's no selected claim, we don't force select, but it's optional.
        // Let's keep it unselected until clicked.
      }
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Re-fetch claims list on tab toggle
  useEffect(() => {
    fetchClaims();
    // Periodically fetch claims list silently to capture status updates
    const claimsInterval = setInterval(() => fetchClaims(true), 10000);
    return () => clearInterval(claimsInterval);
  }, [claimType]);

  // Handle selectedClaimId messaging polling
  useEffect(() => {
    if (chatPollRef.current) {
      clearInterval(chatPollRef.current);
    }

    if (!selectedClaimId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        const data = await api.getClaimMessages(selectedClaimId);
        setMessages(data);
      } catch (err) {
        console.error('Polling error:', err.message);
      }
    };

    fetchMessages(); // initial fetch
    
    // Poll every 3 seconds for new messages
    chatPollRef.current = setInterval(fetchMessages, 3000);

    return () => {
      if (chatPollRef.current) {
        clearInterval(chatPollRef.current);
      }
    };
  }, [selectedClaimId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    setSendingMessage(true);
    const textToSend = newMessageText.trim();
    setNewMessageText(''); // optimistic clear

    try {
      const sentMsg = await api.sendClaimMessage(selectedClaimId, textToSend);
      // Optimistic UI update
      setMessages(prev => [...prev, sentMsg]);
    } catch (err) {
      triggerToast(err.message, 'error');
      setNewMessageText(textToSend); // restore on error
    } finally {
      setSendingMessage(false);
    }
  };

  const handleModerate = async (claimId, newStatus) => {
    const actionText = newStatus === 'approved' ? 'approve' : 'decline';
    if (!window.confirm(`Are you sure you want to ${actionText} this claim? This will update the item status.`)) {
      return;
    }

    try {
      await api.moderateClaim(claimId, newStatus);
      triggerToast(`Claim successfully ${newStatus}!`, 'success');
      
      // Refresh claim list and messages
      fetchClaims(true);
      
      // Update selected claim context
      const updatedMessages = await api.getClaimMessages(claimId);
      setMessages(updatedMessages);
    } catch (err) {
      triggerToast(err.message, 'error');
    }
  };

  const selectedClaim = claims.find(c => c._id === selectedClaimId);

  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🤝 Claim Verification Inbox
      </h2>

      <div className="chat-layout-grid">
        
        {/* Left Side: Active Claim List */}
        <div className="chat-sidebar">
          <div className="type-filter-group" style={{ marginBottom: '1rem', padding: '2px' }}>
            <button
              type="button"
              className={`type-filter-btn ${claimType === 'received' ? 'active' : ''}`}
              onClick={() => { setClaimType('received'); setSelectedClaimId(null); }}
              style={{ fontSize: '0.8rem', padding: '0.4rem' }}
            >
              Claims Received
            </button>
            <button
              type="button"
              className={`type-filter-btn ${claimType === 'sent' ? 'active' : ''}`}
              onClick={() => { setClaimType('sent'); setSelectedClaimId(null); }}
              style={{ fontSize: '0.8rem', padding: '0.4rem' }}
            >
              Claims Sent
            </button>
          </div>

          <div className="chat-inbox-list">
            {loading ? (
              <p style={{ padding: '1rem', textAlign: 'center' }}>Loading inbox...</p>
            ) : claims.length === 0 ? (
              <p style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                No active conversations found.
              </p>
            ) : (
              claims.map(claim => {
                const item = claim.itemId || {};
                const otherParty = claimType === 'received' 
                  ? (claim.claimantId || {}) 
                  : (claim.ownerId || {});
                const isActive = claim._id === selectedClaimId;

                return (
                  <div
                    key={claim._id}
                    className={`inbox-item-card ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedClaimId(claim._id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="inbox-item-title">{item.title || 'Deleted Item'}</span>
                      <span className={`status-pill status-${claim.status}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                        {claim.status === 'pending' ? 'Pending' : claim.status}
                      </span>
                    </div>
                    <div className="inbox-item-subtitle">
                      <span>👤 {otherParty.username || 'Unknown'}</span>
                      <span>{new Date(claim.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div className="chat-window-panel">
          {selectedClaim ? (
            <div className="chat-container-flex">
              
              {/* Chat Header Details & Moderation Actions */}
              <div className="chat-window-header">
                <div>
                  <h3 
                    style={{ fontSize: '1.15rem', color: 'var(--primary)', cursor: 'pointer', display: 'inline-block' }}
                    onClick={() => onViewItem(selectedClaim.itemId?._id || selectedClaim.itemId)}
                    title="Click to view item details"
                  >
                    🔍 {selectedClaim.itemId?.title || 'Item Details'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Category: {selectedClaim.itemId?.category} • Status: {selectedClaim.itemId?.status === 'claimed' ? 'Claim Pending' : selectedClaim.itemId?.status}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Status Indicator */}
                  <span className={`status-pill status-${selectedClaim.status}`} style={{ fontWeight: 700 }}>
                    Verification: {selectedClaim.status === 'pending' ? 'In Progress' : selectedClaim.status}
                  </span>

                  {/* Owner Action Controls */}
                  {claimType === 'received' && selectedClaim.status === 'pending' && (
                    <div className="actions-cell">
                      <button 
                        onClick={() => handleModerate(selectedClaim._id, 'approved')} 
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#28a745', color: '#ffffff' }}
                      >
                        ✔ Accept Claim
                      </button>
                      <button 
                        onClick={() => handleModerate(selectedClaim._id, 'rejected')} 
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#dc3545', color: '#ffffff' }}
                      >
                        ❌ Decline Claim
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Message Box */}
              <div className="chat-messages-box">
                <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem', padding: '0.5rem', background: 'var(--primary-glow)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  🔒 Private Claim verification channel established between Owner & Claimant.
                </div>
                
                {messages.map((msg, i) => {
                  const sender = msg.senderId || {};
                  const isMe = sender._id === currentUser._id;
                  const isSystem = !sender._id; // system auto messages

                  return (
                    <div 
                      key={msg._id || i} 
                      className={`chat-bubble-row ${isMe ? 'outgoing' : 'incoming'}`}
                    >
                      <div className="chat-bubble-container">
                        {!isMe && <span className="chat-bubble-sender">{sender.username || 'System'}</span>}
                        <div className="chat-bubble">
                          <p style={{ margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                        </div>
                        <span className="chat-bubble-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              {selectedClaim.status === 'pending' && selectedClaim.itemId?.status !== 'resolved' ? (
                <form onSubmit={handleSendMessage} className="chat-input-form">
                  <input
                    type="text"
                    className="form-control chat-input-text"
                    placeholder="Ask questions or upload details to verify ownership..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    disabled={sendingMessage}
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={sendingMessage || !newMessageText.trim()}
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    {sendingMessage ? '...' : 'Send'}
                  </button>
                </form>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-sm)', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  🔒 This verification chat is closed because the claim status has been marked as <strong>{selectedClaim.status}</strong>.
                </div>
              )}

            </div>
          ) : (
            <div className="chat-empty-state">
              <span style={{ fontSize: '3.5rem' }}>💬</span>
              <h3>Open Verification Channel</h3>
              <p>Select an active claim conversation from the inbox panel on the left to start verifying ownership details.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
