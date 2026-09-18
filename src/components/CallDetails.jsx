import React from 'react';

function CallDetails({ calls, selectedCallSid, onSelect }) {
  if (!calls || calls.length === 0) {
    return (
      <section className="panel call-details">
        <h2>Call History</h2>
        <p className="empty-state">No calls yet</p>
      </section>
    );
  }

  return (
    <section className="panel call-details">
      <h2>Call History</h2>
      <ul className="call-list">
        {calls.map((call) => (
          <li key={call.callSid}>
            <button
              type="button"
              className={
                call.callSid === selectedCallSid
                  ? 'call-list-item active'
                  : 'call-list-item'
              }
              onClick={() => onSelect(call.callSid)}
            >
              <span className="caller">
                {call.direction === 'outbound'
                  ? call.to || 'Unknown'
                  : call.from || 'Unknown'}
              </span>
              <span className="call-meta">
                {call.direction === 'outbound' ? 'out · ' : ''}
                {call.status}
                {typeof call.duration === 'number'
                  ? ` · ${call.duration}s`
                  : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CallDetails;
