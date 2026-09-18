import React, { useEffect, useRef } from 'react';

function ConversationPanel({ messages, aiProcessing, aiWaiting }) {
  const endRef = useRef(null);
  const hasStreamingAssistant = (messages || []).some(
    (m) => m.role === 'assistant' && m.streaming
  );

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, aiProcessing, aiWaiting]);

  if (!messages || messages.length === 0) {
    return (
      <section className="panel conversation-panel">
        <h2>Conversation</h2>
        <p className="empty-state">No conversation yet</p>
      </section>
    );
  }

  return (
    <section className="panel conversation-panel">
      <h2>Conversation</h2>
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}-${msg.timestamp || index}`}
            className={`message ${msg.role}${msg.streaming ? ' streaming' : ''}`}
          >
            <span className="message-role">
              {msg.role === 'user'
                ? 'Caller'
                : msg.role === 'assistant'
                  ? 'AI Assistant'
                  : 'System'}
            </span>
            <p className="message-content">&ldquo;{msg.content}&rdquo;</p>
          </div>
        ))}
        {aiWaiting ? (
          <div className="message system waiting">
            <span className="message-role">System</span>
            <p className="message-content">Waiting for caller to continue…</p>
          </div>
        ) : null}
        {aiProcessing && !aiWaiting && !hasStreamingAssistant ? (
          <div className="message assistant processing">
            <span className="message-role">AI Assistant</span>
            <p className="message-content">Thinking...</p>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </section>
  );
}

export default ConversationPanel;
