import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAgent,
  createAgent,
  updateAgent,
  getKnowledgeStatus,
} from '../services/api.js';

function formatSavingPercent(percent) {
  const n = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return `Saving ${n}%`;
}

function AgentConfigPanel() {
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [knowledge, setKnowledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [waitingForIndex, setWaitingForIndex] = useState(false);
  const [savePercent, setSavePercent] = useState(0);
  const pollRef = useRef(null);
  const waitingForIndexRef = useRef(false);
  const sawIndexingRef = useRef(false);
  const saveStartedAtRef = useRef(0);

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

  // Live saving % while indexing; show Saved or save error when done.
  useEffect(() => {
    if (!waitingForIndexRef.current || !knowledge) {
      return;
    }
    const status = knowledge.status;
    const progress = knowledge.progress || null;

    if (status === 'pending' || status === 'indexing') {
      sawIndexingRef.current = true;
      let nextPercent = 5;
      if (progress && progress.active && Number.isFinite(Number(progress.percent))) {
        nextPercent = Number(progress.percent);
      } else if (status === 'indexing') {
        nextPercent = 10;
      }
      setSavePercent((prev) => Math.max(prev, nextPercent));
      setMessage(formatSavingPercent(nextPercent));
      return;
    }
    if (status === 'failed') {
      waitingForIndexRef.current = false;
      sawIndexingRef.current = false;
      setWaitingForIndex(false);
      setSavePercent(0);
      setMessage('');
      const detail =
        (knowledge.error && String(knowledge.error).trim()) ||
        'Indexing failed. Please try again.';
      setError(`Saving error: ${detail}`);
      return;
    }
    if (status === 'ready') {
      const waitedMs = Date.now() - saveStartedAtRef.current;
      if (!sawIndexingRef.current && waitedMs < 1500) {
        setSavePercent((prev) => Math.max(prev, 15));
        setMessage(formatSavingPercent(15));
        return;
      }
      waitingForIndexRef.current = false;
      sawIndexingRef.current = false;
      setWaitingForIndex(false);
      setSavePercent(100);
      setError('');
      setMessage('Saved');
    }
  }, [knowledge]);

  useEffect(() => {
    const status = knowledge && knowledge.status;
    const needsPoll =
      waitingForIndexRef.current ||
      status === 'pending' ||
      status === 'indexing';
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
    // Poll often enough for smooth live % updates.
    pollRef.current = setInterval(() => {
      refreshKnowledge();
    }, 500);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [knowledge, message, refreshKnowledge]);

  function beginIndexWait() {
    waitingForIndexRef.current = true;
    sawIndexingRef.current = false;
    saveStartedAtRef.current = Date.now();
    setWaitingForIndex(true);
    setSavePercent(8);
    setMessage(formatSavingPercent(8));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage(formatSavingPercent(2));
    setSavePercent(2);
    try {
      let data = await createAgent({
        name: name.trim() || 'Agent',
        prompt: prompt.trim() || undefined,
      });
      if (prompt.trim()) {
        setSavePercent(6);
        setMessage(formatSavingPercent(6));
        data = await updateAgent({
          name: name.trim() || 'Agent',
          prompt: prompt.trim(),
        });
        beginIndexWait();
      } else {
        setMessage('Saved');
        setSavePercent(0);
      }
      applyAgent(data.agent);
      await refreshKnowledge();
    } catch (err) {
      waitingForIndexRef.current = false;
      setWaitingForIndex(false);
      setSavePercent(0);
      setMessage('');
      setError(`Saving error: ${err.message || 'Create failed'}`);
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
    setSavePercent(2);
    setMessage(formatSavingPercent(2));
    try {
      const data = await updateAgent({
        name: name.trim(),
        prompt: trimmedPrompt,
      });
      applyAgent(data.agent);
      beginIndexWait();
      await refreshKnowledge();
    } catch (err) {
      waitingForIndexRef.current = false;
      setWaitingForIndex(false);
      setSavePercent(0);
      setMessage('');
      setError(`Saving error: ${err.message || 'Save failed'}`);
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

  if (!agent) {
    return (
      <section className="panel agent-config">
        <h2>Agent Configuration</h2>
        <p className="field-hint">
          Agent Name is spoken on calls. Agent Prompt holds company knowledge
          and company-specific rules (indexed on save). Generic conversation
          protection is built into the voice agent.
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
              {saving ? formatSavingPercent(savePercent || 2) : 'Create agent'}
            </button>
          </div>
        </form>
        {message && !error ? (
          <p className={message === 'Saved' ? 'success-text' : 'saving-text'}>
            {message}
          </p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    );
  }

  const busy = saving || waitingForIndex;
  const buttonLabel = busy
    ? formatSavingPercent(
        message === 'Saved' ? 100 : savePercent || (saving ? 2 : 8)
      )
    : 'Save';

  return (
    <section className="panel agent-config">
      <h2>Agent Configuration</h2>

      <form className="agent-config-form" onSubmit={handleSave}>
        <div className="agent-meta-row">
          <label className="agent-field agent-field-grow">
            Agent name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <div className="agent-actions agent-actions-inline">
            <button
              type="submit"
              className="btn-primary btn-compact"
              disabled={busy}
            >
              {buttonLabel}
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
            disabled={busy}
            required
          />
        </label>
      </form>

      {busy && message !== 'Saved' ? (
        <div className="saving-progress" aria-live="polite">
          <div className="saving-progress-track">
            <div
              className="saving-progress-bar"
              style={{ width: `${Math.max(2, Math.min(100, savePercent))}%` }}
            />
          </div>
          <p className="saving-text">{formatSavingPercent(savePercent)}</p>
        </div>
      ) : null}
      {message === 'Saved' && !error ? (
        <p className="success-text">Saved</p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

export default AgentConfigPanel;
