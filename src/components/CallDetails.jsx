import React, { useCallback, useRef } from 'react';

function CallDetails({
  calls,
  selectedCallSid,
  onSelect,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}) {
  const listRef = useRef(null);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore || loadingMore || typeof onLoadMore !== 'function') {
      return;
    }
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (nearBottom) {
      onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore]);

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
      <ul className="call-list" ref={listRef} onScroll={handleScroll}>
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
        {loadingMore ? (
          <li className="call-list-footer muted">Loading…</li>
        ) : null}
        {!hasMore && calls.length > 0 ? (
          <li className="call-list-footer muted">End of history</li>
        ) : null}
      </ul>
    </section>
  );
}

export default CallDetails;
