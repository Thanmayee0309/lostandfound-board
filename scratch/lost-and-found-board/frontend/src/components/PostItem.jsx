import React, { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';

const CATEGORIES = [
  'Electronics',
  'Keys & ID Cards',
  'Wallets & Cards',
  'Books & Stationery',
  'Clothing & Bags',
  'Documents',
  'Other'
];

export default function PostItem({ onPostSuccess, triggerToast }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [type, setType] = useState('lost'); // 'lost' | 'found'
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const pinMarker = useRef(null);

  // Initialize Map for location selection
  useEffect(() => {
    const defaultLat = 17.2185;
    const defaultLng = 78.2736;
    const L = window.L;

    if (L && mapRef.current && !mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([defaultLat, defaultLng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      // Map Click Event
      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));

        // Place or move marker
        if (pinMarker.current) {
          pinMarker.current.setLatLng(e.latlng);
        } else {
          // Custom SVG marker pin
          const pinColor = type === 'lost' ? '#dc3545' : '#28a745';
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

          pinMarker.current = L.marker(e.latlng, { icon: svgIcon, draggable: true }).addTo(mapInstance.current);
          
          pinMarker.current.on('dragend', (de) => {
            const pos = de.target.getLatLng();
            setLatitude(pos.lat.toFixed(6));
            setLongitude(pos.lng.toFixed(6));
          });
        }
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.off();
        mapInstance.current.remove();
        mapInstance.current = null;
        pinMarker.current = null;
      }
    };
  }, [type]); // Re-render icon colors if type switches

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !locationText || !date) {
      triggerToast('Please fill out all required fields.', 'error');
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('type', type);
    formData.append('date', date);
    formData.append('locationText', locationText);
    
    if (latitude && longitude) {
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
    }

    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      await api.postItem(formData);
      triggerToast('Item posted successfully! AI search is running.', 'success');
      onPostSuccess();
    } catch (err) {
      triggerToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        📢 Report a New Item
      </h2>

      <form onSubmit={handleSubmit} className="post-item-form">
        
        {/* Toggle Lost/Found */}
        <div className="form-group">
          <label>Report Type *</label>
          <div className="type-filter-group" style={{ maxWidth: '300px' }}>
            <button
              type="button"
              className={`type-filter-btn ${type === 'lost' ? 'active' : ''}`}
              style={type === 'lost' ? { background: '#fde8eb', color: '#dc3545' } : {}}
              onClick={() => setType('lost')}
            >
              I Lost Something
            </button>
            <button
              type="button"
              className={`type-filter-btn ${type === 'found' ? 'active' : ''}`}
              style={type === 'found' ? { background: '#e2f2e9', color: '#28a745' } : {}}
              onClick={() => setType('found')}
            >
              I Found Something
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="title">Item Title *</label>
            <input
              type="text"
              id="title"
              className="form-control"
              placeholder="e.g. Black Leather Keychain"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              className="form-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description *</label>
          <textarea
            id="description"
            className="form-control"
            rows="3"
            placeholder="Provide details like brand, color, unique marks, or contents. (AI matching matches keywords from this)."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          ></textarea>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Date Lost/Found *</label>
            <input
              type="date"
              id="date"
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="locationText">Location Description *</label>
            <input
              type="text"
              id="locationText"
              className="form-control"
              placeholder="e.g. Near Library Seminar Hall, 2nd floor"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Map pinning locator */}
        <div className="form-group">
          <span className="map-selector-label">Pin Location on Campus Map (Optional)</span>
          <span className="map-selector-help">
            Click on the map grid below to drop a pinpoint of where the item was lost or found.
          </span>
          <div className="map-selector-container">
            <div id="map-select" ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 10 }}></div>
          </div>
          {latitude && longitude && (
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
              Selected Location: Lat {latitude}, Lng {longitude}
            </p>
          )}
        </div>

        {/* Image upload */}
        <div className="form-group">
          <label>Item Image (Optional)</label>
          {!imagePreview ? (
            <div className="upload-zone" onClick={() => document.getElementById('image-file').click()}>
              <span className="upload-icon">📷</span>
              <p style={{ fontWeight: 600 }}>Click to upload an image of the item</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Supports PNG, JPG, JPEG (Max 5MB)</p>
              <input
                type="file"
                id="image-file"
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
          ) : (
            <div className="upload-preview-container">
              <img src={imagePreview} alt="Upload preview" />
              <button type="button" className="upload-remove-btn" onClick={handleRemoveImage}>
                ❌
              </button>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ flex: 1 }}
            disabled={submitting}
          >
            {submitting ? 'Posting Report...' : 'Publish Board Posting'}
          </button>
        </div>
      </form>
    </div>
  );
}
