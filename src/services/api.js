/**
 * Resolve API base so the dashboard works on localhost AND LAN IPs
 * (e.g. http://192.168.5.49:5173 → same-origin Vite proxy → backend).
 *
 * Prefer same-origin (empty string) when VITE_API_BASE_URL is unset or points
 * at localhost while the page is opened via a LAN hostname.
 */
function resolveApiBase() {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (typeof window === 'undefined') {
    return configured || 'http://localhost:3000';
  }

  const pageHost = window.location.hostname;
  const isLocalPage =
    pageHost === 'localhost' || pageHost === '127.0.0.1';
  const configuredIsLocal =
    !configured ||
    /localhost|127\.0\.0\.1/.test(configured);

  // LAN / remote page: use Vite same-origin proxy (or same host :3000 if forced).
  if (!isLocalPage && configuredIsLocal) {
    return '';
  }

  return configured || '';
}

const API_BASE = resolveApiBase();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body && body.error) {
        message = body.error;
      }
    } catch {
      // keep status message
    }
    throw new Error(message);
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

export function startOutboundCall(phoneNumber) {
  return request('/api/outbound-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
  });
}

export function hangupOutboundCall(callSid) {
  return request(
    `/api/outbound-call/${encodeURIComponent(callSid)}/hangup`,
    { method: 'POST' }
  );
}

export function getAgent() {
  return request('/api/agent');
}

export function createAgent({ name, languages, prompt } = {}) {
  const body = { name };
  if (languages !== undefined) body.languages = languages;
  if (prompt !== undefined) body.prompt = prompt;
  return request('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateAgent({ name, status, languages, prompt }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (status !== undefined) body.status = status;
  if (languages !== undefined) body.languages = languages;
  if (prompt !== undefined) body.prompt = prompt;
  return request('/api/agent', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function addPrompt(text) {
  return request('/api/agent/prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function updatePrompt(promptId, text) {
  return request(`/api/agent/prompts/${encodeURIComponent(promptId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function deletePrompt(promptId) {
  return request(`/api/agent/prompts/${encodeURIComponent(promptId)}`, {
    method: 'DELETE',
  });
}

export function getKnowledgeStatus() {
  return request('/api/knowledge/status');
}
