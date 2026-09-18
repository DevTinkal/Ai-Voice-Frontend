/**
 * Dashboard WS URL: same host as the page when opened via LAN IP,
 * so http://192.168.5.49:5173 uses the Vite WS proxy (or :3000).
 */
function resolveDashboardWsUrl() {
  const configured = (import.meta.env.VITE_DASHBOARD_WS_URL || '').trim();

  if (typeof window === 'undefined') {
    return configured || 'ws://localhost:3000/dashboard';
  }

  const pageHost = window.location.hostname;
  const isLocalPage =
    pageHost === 'localhost' || pageHost === '127.0.0.1';
  const configuredIsLocal =
    !configured ||
    /localhost|127\.0\.0\.1/.test(configured);

  if (!isLocalPage && configuredIsLocal) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Same origin → Vite proxies /dashboard → backend
    return `${proto}//${window.location.host}/dashboard`;
  }

  if (configured) {
    return configured;
  }

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/dashboard`;
}

const WS_URL = resolveDashboardWsUrl();

/**
 * Connect to the dashboard WebSocket and invoke onEvent for each message.
 * Returns a cleanup function.
 */
export function connectDashboardSocket({ onEvent, onStatus }) {
  let socket = null;
  let closedByUser = false;
  let retryTimer = null;
  let attempt = 0;

  function connect() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      attempt = 0;
      if (onStatus) {
        onStatus('connected');
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onEvent) {
          onEvent(data);
        }
      } catch {
        // ignore malformed
      }
    };

    socket.onclose = () => {
      if (onStatus) {
        onStatus('disconnected');
      }
      if (!closedByUser) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      }
    };

    socket.onerror = () => {
      // close will fire and trigger reconnect
    };
  }

  connect();

  return () => {
    closedByUser = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    if (socket) {
      socket.close();
    }
  };
}
