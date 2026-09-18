import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAgent,
  createAgent,
  updateAgent,
  getKnowledgeStatus,
} from '../services/api.js';

function AgentConfigPanel() {
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pollRef = useRef(null);

  const applyAgent = useCallback((a) => {
    setAgent(a);
    if (a) {
      setName(a.name || '');
      setPrompt(
        a.prompt || (a.prompts && a.prompts[0] && a.prompts[0].text) || ''
      );
    }
  }, []);

  const refreshKnowledge = useCallback(async () => {
    try {
      const data = await getKnowledgeStatus();
      setKnowledge(data.knowledge || null);
    } catch {
      setKnowledge(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const data = await getAgent();
      applyAgent(data.agent || null);
    } catch (err) {
      if (err && /not found/i.test(err.message)) {
        setAgent(null);
        setName('');
        setPrompt('');
      } else {
        setError(err.message || 'Failed to load agent');
      }
    } finally {
      setLoading(false);
    }
    refreshKnowledge();
  }, [applyAgent, refreshKnowledge]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const status = knowledge && knowledge.status;
    const needsPoll = status === 'pending' || status === 'indexing';
    if (!needsPoll) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    if (pollRef.current) {
      return undefined;
    }
    pollRef.current = setInterval(() => {
      refreshKnowledge();
    }, 1800);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [knowledge, refreshKnowledge]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let data = await createAgent({
        name: name.trim() || 'Agent',
        prompt: prompt.trim() || undefined,
      });
      if (prompt.trim()) {
        data = await updateAgent({
          name: name.trim() || 'Agent',
          prompt: prompt.trim(),
        });
      }
      applyAgent(data.agent);
      setMessage('Agent created — indexing prompt…');
      await refreshKnowledge();
    } catch (err) {
      setError(err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError('Agent Prompt is required');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await updateAgent({
        name: name.trim(),
        prompt: trimmedPrompt,
      });
      applyAgent(data.agent);
      setMessage('Saved — indexing for search…');
      await refreshKnowledge();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="panel agent-config">
        <h2>Agent Configuration</h2>
        <p className="muted">Loading…</p>
      </section>
    );
  }

  const kbStatus = knowledge && knowledge.status ? knowledge.status : 'missing';
  const kbChunks =
    knowledge && knowledge.chunkCount != null ? knowledge.chunkCount : 0;
  const kbChars =
    knowledge && knowledge.charCount != null ? knowledge.charCount : 0;

  if (!agent) {
    return (
      <section className="panel agent-config">
        <h2>Agent Configuration</h2>
        <p className="field-hint">
          One Agent Prompt holds everything (instructions and company
          knowledge). On save it is indexed; calls retrieve only relevant
          sections.
        </p>
        <form className="agent-config-form" onSubmit={handleCreate}>
          <label className="agent-field">
            Agent name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Deep"
              disabled={saving}
              required
            />
          </label>
          <label className="agent-field">
            Agent Prompt
            <textarea
              rows={16}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste the complete agent instructions and company knowledge…"
              disabled={saving}
            />
          </label>
          <div className="agent-actions">
            <button
              type="submit"
              className="btn-primary btn-compact"
              disabled={saving}
            >
              Create agent
            </button>
          </div>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel agent-config">
      <h2>Agent Configuration</h2>
      {/* <p className="field-hint">
        Everything lives in this field. On save it is indexed; calls retrieve
        only relevant sections — the full text is never sent to Gemini as
        systemInstruction.
      </p> */}

      <form className="agent-config-form" onSubmit={handleSave}>
        <div className="agent-meta-row">
          <label className="agent-field agent-field-grow">
            Agent name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              required
            />
          </label>
          <div className="agent-actions agent-actions-inline">
            <button
              type="submit"
              className="btn-primary btn-compact"
              disabled={saving}
            >
              Save
            </button>
          </div>
        </div>

        <label className="agent-field">
          Agent Prompt
          <textarea
            rows={18}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Complete instructions + company knowledge…"
            disabled={saving}
            required
          />
          <span className="field-hint">
            {/* {prompt.length.toLocaleString()} characters */}
          </span>
        </label>
      </form>

      {/* <div className="kb-status-badge">
        <span className="muted">Index:</span>{' '}
        <span className={`kb-status kb-status-${kbStatus}`}>{kbStatus}</span>
        {kbStatus === 'ready' ? (
          <span className="muted">
            {' '}
            · {kbChunks.toLocaleString()} chunks · {kbChars.toLocaleString()}{' '}
            chars
          </span>
        ) : null}
        {knowledge && knowledge.error ? (
          <span className="error-text"> — {knowledge.error}</span>
        ) : null}
      </div> */}

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

export default AgentConfigPanel;
