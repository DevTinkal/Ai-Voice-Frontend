import React, { useEffect, useState } from 'react';

function formatDuration(startedAt) {
  if (!startedAt) {
    return '00:00';
  }
  const start = new Date(startedAt).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function CallStatus({ activeCall, aiProcessing, aiWaiting, memoryTurns = 0 }) {
  const [duration, setDuration] = useState('00:00');

  useEffect(() => {
    if (!activeCall) {
      setDuration('00:00');
      return undefined;
    }

    const tick = () => {
      setDuration(
        formatDuration(activeCall.answeredAt || activeCall.startedAt)
      );
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  if (!activeCall) {
    return (
      <section className="panel call-status">
        <h2>Current Call</h2>
        <p className="empty-state">No active call</p>
      </section>
    );
  }

  let statusLabel = activeCall.status || 'Connected';
  if (aiWaiting) {
    statusLabel = 'Waiting for caller';
  } else if (aiProcessing) {
    statusLabel = 'AI Processing';
  }

  const turnLabel =
    memoryTurns === 1 ? '1 turn from database' : `${memoryTurns} turns from database`;

  return (
    <section className="panel call-status">
      <h2>Current Call</h2>
      <dl className="meta-list">
        <div>
          <dt>Status</dt>
          <dd className={aiWaiting ? 'status-waiting' : 'status-connected'}>
            {statusLabel}
          </dd>
        </div>
        <div>
          <dt>Caller</dt>
          <dd>{activeCall.from || 'Unknown'}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{duration}</dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd className="memory-from-db">{turnLabel}</dd>
        </div>
        <div>
          <dt>Call SID</dt>
          <dd className="mono">{activeCall.callSid}</dd>
        </div>
      </dl>
    </section>
  );
}

export default CallStatus;
