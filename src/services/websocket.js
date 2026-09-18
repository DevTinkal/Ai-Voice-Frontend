const WS_URL =
  import.meta.env.VITE_DASHBOARD_WS_URL || 'ws://localhost:3000/dashboard';

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
