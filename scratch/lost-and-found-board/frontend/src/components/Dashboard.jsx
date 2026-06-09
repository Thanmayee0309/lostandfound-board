import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

const CATEGORIES = [
  'All',
  'Electronics',
  'Keys & ID Cards',
  'Wallets & Cards',
  'Books & Stationery',
  'Clothing & Bags',
  'Documents',
  'Other'
];

export default function Dashboard({ onViewItem, triggerToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [type, setType] = useState('all'); // 'all' | 'lost' | 'found'
  const [status, setStatus] = useState('open'); // 'all' | 'open' | 'claimed' | 'resolved'
  
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersGroup = useRef(null);

  // Fetch Items on filter changes
  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const data = await api.getItems({
          category,
          type,
          status,
          search
        });
        if (active) {
          setItems(data);
        }
      } catch (err) {
        triggerToast(err.message, 'error');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchItems();
    
    return () => {
      active = false;
    };
  }, [category, type, status, search]);

  // Leaflet Map Initialization
  useEffect(() => {
    // Center at Vardhaman College of Engineering coordinates
    const defaultLat = 17.2185;
    const defaultLng = 78.2736;

    if (!mapInstance.current && mapRef.current) {
      // Import Leaflet dynamically to avoid SSR/bundling issues
      const L = window.L;
      if (!L) return;

      mapInstance.current = L.map(mapRef.current).setView([defaultLat, defaultLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markersGroup.current = L.layerGroup().addTo(mapInstance.current);

      // Register global callback for Leaflet popup button click
      window.viewItemFromMap = (id) => {
        onViewItem(id);
      };
    }

    return () => {
      // Map cleanup happens when parent unmounts completely
    };
  }, []);

  // Update map markers when items load
  useEffect(() => {
    const L = window.L;
    if (!L || !mapInstance.current || !markersGroup.current) return;

    // Clear existing markers
    markersGroup.current.clearLayers();

    const itemsWithCoords = items.filter(item => item.latitude && item.longitude);

    itemsWithCoords.forEach(item => {
      const pinColor = item.type === 'lost' ? '#dc3545' : '#28a745';
      
      // Create a custom SVG colored marker pin
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

      const popupContent = `
        <div class="custom-map-popup">
          <h4 style="font-weight: 700; margin-bottom: 4px;">${item.title}</h4>
          <span style="
            display: inline-block;
            font-size: 0.65rem;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 10px;
            text-transform: uppercase;
            background: ${item.type === 'lost' ? '#fde8eb' : '#e2f2e9'};
            color: ${item.type === 'lost' ? '#dc3545' : '#28a745'};
            margin-bottom: 6px;
          ">${item.type}</span>
          <p style="font-size: 0.8rem; margin: 4px 0; opacity: 0.8;">📍 ${item.locationText}</p>
          <button class="btn btn-secondary" 
                  style="padding: 4px 8px; font-size: 0.75rem; margin-top: 6px; width: 100%;" 
                  onclick="window.viewItemFromMap('${item._id}')">
            View Details
          </button>
        </div>
      `;

      const marker = L.marker([item.latitude, item.longitude], { icon: svgIcon })
        .bindPopup(popupContent);
        
      markersGroup.current.addLayer(marker);
    });

    // Fit map bounds to markers if we have some
    if (itemsWithCoords.length > 0 && mapInstance.current) {
      const bounds = L.latLngBounds(itemsWithCoords.map(item => [item.latitude, item.longitude]));
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [items]);

  const handleSearchChange = (e) => setSearch(e.target.value);
  const handleCategoryChange = (cat) => setCategory(cat);
  const handleTypeChange = (t) => setType(t);
  const handleStatusChange = (e) => setStatus(e.target.value);

  return (
    <div className="dashboard-layout">
      {/* Left panel: Filters and Cards */}
      <div className="sidebar-panel">
        
        {/* Search & Filter Component */}
        <div className="glass-card search-filter-box">
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search lost & found items..."
              value={search}
              onChange={handleSearchChange}
            />
            
            <select 
              className="select-input"
              value={status}
              onChange={handleStatusChange}
            >
              <option value="all">All Status</option>
              <option value="open">Active Only</option>
              <option value="claimed">Claimed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="filter-row">
            {/* Custom Tab selector for Type */}
            <div className="type-filter-group" style={{ flex: 1 }}>
              <button 
                type="button" 
                className={`type-filter-btn ${type === 'all' ? 'active' : ''}`}
                onClick={() => handleTypeChange('all')}
              >
                All Type
              </button>
              <button 
                type="button" 
                className={`type-filter-btn ${type === 'lost' ? 'active' : ''}`}
                onClick={() => handleTypeChange('lost')}
              >
                Lost
              </button>
              <button 
                type="button" 
                className={`type-filter-btn ${type === 'found' ? 'active' : ''}`}
                onClick={() => handleTypeChange('found')}
              >
                Found
              </button>
            </div>
            
            <select
              className="select-input"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              style={{ flex: 1 }}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* List of cards */}
        <div className="items-list">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Loading items...</p>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }} className="glass-card">
              <span style={{ fontSize: '3rem' }}>🔍</span>
              <p style={{ marginTop: '1rem', fontWeight: 600 }}>No items match your criteria.</p>
            </div>
          ) : (
            items.map(item => (
              <div 
                key={item._id} 
                className="glass-card item-card"
                onClick={() => onViewItem(item._id)}
              >
                <div className="item-img-container">
                  {item.imageUrl ? (
                    <img src={`http://localhost:5000${item.imageUrl}`} alt={item.title} />
                  ) : (
                    <span className="item-fallback-icon">
                      {item.type === 'lost' ? '❓' : '🎁'}
                    </span>
                  )}
                </div>

                <div className="item-info">
                  <div>
                    <div className="item-card-header">
                      <h3 className="item-title">{item.title}</h3>
                      <span className={`badge-tag tag-${item.type}`}>
                        {item.type}
                      </span>
                    </div>
                    <p className="item-desc-snippet">{item.description}</p>
                  </div>
                  
                  <div className="item-card-footer">
                    <span className="item-location">
                      📍 {item.locationText}
                    </span>
                    <span className="item-date">
                      {new Date(item.date).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Leaflet Map */}
      <div className="map-panel">
        <div id="map-dashboard" className="map-container" ref={mapRef}></div>
      </div>
    </div>
  );
}
