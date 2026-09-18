const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export function fetchHealth() {
  return request('/health');
}

export function fetchStats() {
  return request('/api/stats');
}

export function fetchCalls(limit = 20) {
  return request(`/api/calls?limit=${limit}`);
}

export function fetchCall(callSid) {
  return request(`/api/calls/${encodeURIComponent(callSid)}`);
}
