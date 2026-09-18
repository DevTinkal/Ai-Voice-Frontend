import React from 'react';

function SystemStatus({ online, database, wsStatus }) {
  // Online when backend is reachable; live feed status is shown separately.
  const isOnline = online;

  return (
    <section className="panel system-status">
      <h2>System Status</h2>
      <div className="status-row">
        <span
          className={`status-dot ${isOnline ? 'online' : 'offline'}`}
          aria-hidden="true"
        />
        <span className="status-label">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      <dl className="meta-list">
        <div>
          <dt>Backend</dt>
          <dd>{online ? 'Reachable' : 'Unreachable'}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd>{database || 'unknown'}</dd>
        </div>
        <div>
          <dt>Live feed</dt>
          <dd>{wsStatus}</dd>
        </div>
      </dl>
    </section>
  );
}

export default SystemStatus;
