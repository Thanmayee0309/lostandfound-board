const BASE_URL = 'http://localhost:5000/api';

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('token');
  const headers = {};
  
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

const handleResponse = async (response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  
  return data;
};

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  async register(username, email, password) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, email, password })
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Items
  async getItems(filters = {}) {
    const query = new URLSearchParams();
    if (filters.category && filters.category !== 'All') query.append('category', filters.category);
    if (filters.type && filters.type !== 'all') query.append('type', filters.type);
    if (filters.status && filters.status !== 'all') query.append('status', filters.status);
    if (filters.search) query.append('search', filters.search);

    const res = await fetch(`${BASE_URL}/items?${query.toString()}`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getItem(id) {
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async getItemMatches(id) {
    const res = await fetch(`${BASE_URL}/items/${id}/matches`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async postItem(formData) {
    const res = await fetch(`${BASE_URL}/items`, {
      method: 'POST',
      headers: getHeaders(true), // Multipart headers (no content-type)
      body: formData
    });
    return handleResponse(res);
  },

  async updateItemStatus(id, status) {
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  async deleteItem(id) {
    const res = await fetch(`${BASE_URL}/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  // Claims
  async submitClaim(itemId, verificationAnswer) {
    const res = await fetch(`${BASE_URL}/claims`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ itemId, verificationAnswer })
    });
    return handleResponse(res);
  },

  async getClaims(type = 'all') {
    const res = await fetch(`${BASE_URL}/claims?type=${type}`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async moderateClaim(claimId, status) {
    const res = await fetch(`${BASE_URL}/claims/${claimId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  // Notifications
  async getNotifications() {
    const res = await fetch(`${BASE_URL}/notifications`, {
      method: 'GET',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async markNotificationRead(id) {
    const res = await fetch(`${BASE_URL}/notifications/${id}`, {
      method: 'PUT',
      headers: getHeaders()
    });
    return handleResponse(res);
  },

  async markAllNotificationsRead() {
    const res = await fetch(`${BASE_URL}/notifications`, {
      method: 'PUT',
      headers: getHeaders()
    });
    return handleResponse(res);
  }
};
