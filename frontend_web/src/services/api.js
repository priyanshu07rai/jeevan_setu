// Extract the VITE_API_BASE_URL (e.g. https://your-backend.render.com/api/v2)
// For local development with Vite proxy, it handles relative paths.
// For production, we must point to the absolute centralized URL.
const envBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v2';

// In production, BASE_URL should be the full URL.
// In dev, if using a proxy, it can be the path.
const BASE_URL = envBase;

// Helper to determine if we should use absolute or relative (useful for local proxy vs remote)
const getPath = (endpoint) => {
    // If the endpoint already starts with http, return it
    if (endpoint.startsWith('http')) return endpoint;
    
    // If BASE_URL is an absolute URL, join them
    if (BASE_URL.startsWith('http')) {
        // Remove trailing slash from BASE_URL if present and leading from endpoint
        const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        // Specific check for payment which doesn't follow /api/v2 in some local files
        if (endpoint.startsWith('/api/payment')) {
            const rootBase = new URL(BASE_URL).origin;
            return `${rootBase}${cleanEndpoint}`;
        }
        
        return `${cleanBase}${cleanEndpoint}`;
    }
    
    // Fallback to relative path for dev proxy
    return endpoint;
};

export const fetchDisasters = async () => {
  try {
    const response = await fetch(getPath('/disasters'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchDisasters error:', error);
    return [];
  }
};

export const fetchRisk = async () => {
  try {
    const response = await fetch(getPath('/risk'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchRisk error:', error);
    return [];
  }
};

export const fetchVolunteers = async () => {
  try {
    const response = await fetch(getPath('/volunteers'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchVolunteers error:', error);
    return [];
  }
};

export const fetchShelters = async () => {
  try {
    const response = await fetch(getPath('/shelters'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchShelters error:', error);
    return [];
  }
};

export const fetchSupplies = async () => {
  try {
    const response = await fetch(getPath('/supplies'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchSupplies error:', error);
    return [];
  }
};

export const submitReport = async (reportData) => {
  try {
    const response = await fetch(getPath('/report'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData),
    });
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('submitReport error:', error);
    throw error;
  }
};

export const fetchActivity = async () => {
  try {
    const response = await fetch(getPath('/activity'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchActivity error:', error);
    return [];
  }
};

export const fetchDonations = async () => {
  try {
    const response = await fetch(getPath('/donations'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchDonations error:', error);
    return [];
  }
};

export const fetchVictims = async () => {
  try {
    const response = await fetch(getPath('/victims'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchVictims error:', error);
    return [];
  }
};

export const likeDonor = async (donorName, userEmail) => {
  try {
    const response = await fetch(getPath('/donations/like'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ donor_name: donorName, email: userEmail }),
    });
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('likeDonor error:', error);
    throw error;
  }
};

export const fetchAssignments = async () => {
  try {
    const response = await fetch(getPath('/assignments'));
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
  } catch (error) {
    console.error('fetchAssignments error:', error);
    return [];
  }
};

// ─── PAYMENT ─────────────────────────────────────────────────────────────
export const fetchPaymentConfig = async () => {
    try {
        const res = await fetch(getPath('/api/payment/config'));
        return res.ok ? await res.json() : null;
    } catch { return null; }
};

export const updatePaymentConfig = async (formData) => {
    const response = await fetch(getPath('/api/payment/config'), { method: 'POST', body: formData });
    if (!response.ok) {
        const text = await response.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await response.json();
};

export const submitPaymentRequest = async (payload) => {
    const res = await fetch(getPath('/api/payment/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const text = await res.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await res.json();
};

export const fetchAdminPayments = async () => {
    try {
        const res = await fetch(getPath('/api/payment/all'));
        return res.ok ? await res.json() : [];
    } catch { return []; }
};

export const fetchUserPayments = async (userId) => {
    try {
        const res = await fetch(getPath(`/api/payment/user/${userId}`));
        return res.ok ? await res.json() : [];
    } catch { return []; }
};

export const approvePayment = async (id) => {
    const res = await fetch(getPath(`/api/payment/approve/${id}`), { method: 'POST' });
    if (!res.ok) {
        const text = await res.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await res.json();
};

export const rejectPayment = async (id) => {
    const res = await fetch(getPath(`/api/payment/reject/${id}`), { method: 'POST' });
    if (!res.ok) {
        const text = await res.text();
        console.error('Backend error:', text);
        throw new Error('Network response was not ok: ' + text);
    }
    return await res.json();
};
