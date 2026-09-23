import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SystemStatus from '../components/SystemStatus.jsx';
import StatsCards from '../components/StatsCards.jsx';
import CallStatus from '../components/CallStatus.jsx';
import CallDetails from '../components/CallDetails.jsx';
import ConversationPanel from '../components/ConversationPanel.jsx';
import OutboundDialer from '../components/OutboundDialer.jsx';
import AgentConfigPanel from '../components/AgentConfigPanel.jsx';
import PlanStatus from '../components/PlanStatus.jsx';
import {
  fetchCall,
  fetchCalls,
  fetchHealth,
  fetchStats,
} from '../services/api.js';
import { connectDashboardSocket } from '../services/websocket.js';

const ACTIVE_STATUSES = new Set(['incoming', 'connected', 'in-progress']);

function formatPhone(number) {
  if (!number) {
    return 'Not configured';
  }
  const digits = String(number).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return number;
}

function Dashboard() {
  const [online, setOnline] = useState(false);
  const [database, setDatabase] = useState('unknown');
  const [wsStatus, setWsStatus] = useState('connecting');
  const [twilioNumber, setTwilioNumber] = useState(
    import.meta.env.VITE_TWILIO_PHONE_NUMBER || ''
  );
  const [stats, setStats] = useState({
    totalCalls: 0,
    activeCalls: 0,
    completedCalls: 0,
    failedCalls: 0,
    callsToday: 0,
  });
  const [calls, setCalls] = useState([]);
  const [callsHasMore, setCallsHasMore] = useState(false);
  const [callsLoadingMore, setCallsLoadingMore] = useState(false);
  const [selectedCallSid, setSelectedCallSid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiWaiting, setAiWaiting] = useState(false);
  const [planInfo, setPlanInfo] = useState({
    publicLinkStatus: 'missing',
    publicBaseUrl: null,
    geminiConfigured: false,
    geminiModel: null,
  });

  const refreshStats = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
    } catch {
      // keep last known values
    }
  }, []);

  const CALLS_PAGE_SIZE = 20;

  const refreshCalls = useCallback(async () => {
    try {
      const data = await fetchCalls(CALLS_PAGE_SIZE, 0);
      const list = data.calls || [];
      setCalls(list);
      setCallsHasMore(Boolean(data.hasMore));

      const live = list.find((c) => ACTIVE_STATUSES.has(c.status));
      if (live) {
        setActiveCall(live);
        if (!selectedCallSid) {
          setSelectedCallSid(live.callSid);
        }
      } else {
        setActiveCall(null);
      }
    } catch {
      // keep last known values
    }
  }, [selectedCallSid]);

  const loadMoreCalls = useCallback(async () => {
    if (callsLoadingMore || !callsHasMore) {
      return;
    }
    setCallsLoadingMore(true);
    try {
      const data = await fetchCalls(CALLS_PAGE_SIZE, calls.length);
      const next = data.calls || [];
      setCalls((prev) => {
        const seen = new Set(prev.map((c) => c.callSid));
        const merged = [...prev];
        for (const call of next) {
          if (!seen.has(call.callSid)) {
            merged.push(call);
            seen.add(call.callSid);
          }
        }
        return merged;
      });
      setCallsHasMore(Boolean(data.hasMore));
    } catch {
      // keep last known values
    } finally {
      setCallsLoadingMore(false);
    }
  }, [calls.length, callsHasMore, callsLoadingMore]);

  const loadCallDetail = useCallback(async (callSid) => {
    if (!callSid) {
      setMessages([]);
      return;
    }
    try {
      const data = await fetchCall(callSid);
      setMessages(data.messages || []);
      if (data.call && ACTIVE_STATUSES.has(data.call.status)) {
        setActiveCall(data.call);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const health = await fetchHealth();
        if (cancelled) {
          return;
        }
        setOnline(true);
        setDatabase(health.database || 'unknown');
        if (health.twilioPhoneNumber) {
          setTwilioNumber(health.twilioPhoneNumber);
        }
        setPlanInfo({
          publicLinkStatus: health.publicLinkStatus || 'missing',
          publicBaseUrl: health.publicBaseUrl || null,
          geminiConfigured: Boolean(health.geminiConfigured),
          geminiModel: health.geminiModel || null,
        });
      } catch {
        if (!cancelled) {
          setOnline(false);
          setDatabase('unreachable');
          setPlanInfo((prev) => ({
            ...prev,
            publicLinkStatus: 'expired',
          }));
        }
      }

      await refreshStats();
      await refreshCalls();
    }

    bootstrap();
    const healthTimer = setInterval(bootstrap, 15000);

    return () => {
      cancelled = true;
      clearInterval(healthTimer);
    };
  }, [refreshCalls, refreshStats]);

  useEffect(() => {
    if (selectedCallSid) {
      loadCallDetail(selectedCallSid);
    }
  }, [selectedCallSid, loadCallDetail]);

  useEffect(() => {
    const disconnect = connectDashboardSocket({
      onStatus: setWsStatus,
      onEvent: (event) => {
        if (!event || !event.type) {
          return;
        }

        const data = event.data || {};

        switch (event.type) {
          case 'SYSTEM_STATUS':
            setOnline(true);
            break;

          case 'CALL_INCOMING':
            setActiveCall({
              callSid: data.callSid,
              from: data.from,
              to: data.to,
              status: 'incoming',
              direction: data.direction || 'inbound',
              startedAt: new Date().toISOString(),
            });
            setSelectedCallSid(data.callSid);
            setMessages([]);
            setAiProcessing(false);
            setAiWaiting(false);
            refreshStats();
            refreshCalls();
            break;

          case 'CALL_OUTBOUND_STARTED':
            setActiveCall({
              callSid: data.callSid,
              from: data.from,
              to: data.to,
              status: data.status || 'incoming',
              direction: 'outbound',
              startedAt: new Date().toISOString(),
            });
            setSelectedCallSid(data.callSid);
            setMessages([]);
            setAiProcessing(false);
            setAiWaiting(false);
            refreshStats();
            refreshCalls();
            break;

          case 'CALL_OUTBOUND_ANSWERED':
            setActiveCall((prev) => ({
              ...(prev || {}),
              callSid: data.callSid,
              from: data.from || prev?.from,
              to: data.to || prev?.to,
              status: 'incoming',
              direction: 'outbound',
              startedAt: prev?.startedAt || new Date().toISOString(),
            }));
            setSelectedCallSid(data.callSid);
            refreshStats();
            refreshCalls();
            break;

          case 'CALL_CONNECTED':
            setActiveCall((prev) => ({
              ...(prev || {}),
              callSid: data.callSid,
              from: data.from || prev?.from,
              to: data.to || prev?.to,
              status: 'connected',
              direction: data.direction || prev?.direction || 'inbound',
              answeredAt: new Date().toISOString(),
            }));
            setSelectedCallSid(data.callSid);
            setAiWaiting(false);
            refreshStats();
            refreshCalls();
            break;

          case 'CALLER_MESSAGE':
            setSelectedCallSid(data.callSid);
            setMessages((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === 'user' && next[i].streaming) {
                  next[i] = {
                    role: 'user',
                    content: data.content,
                    streaming: false,
                    timestamp: new Date().toISOString(),
                  };
                  return next;
                }
              }
              next.push({
                role: 'user',
                content: data.content,
                streaming: false,
                timestamp: new Date().toISOString(),
              });
              return next;
            });
            setAiProcessing(false);
            break;

          case 'CALLER_STREAMING':
            setSelectedCallSid(data.callSid);
            setMessages((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === 'user' && next[i].streaming) {
                  next[i] = {
                    ...next[i],
                    content: data.content,
                    timestamp: new Date().toISOString(),
                  };
                  return next;
                }
              }
              next.push({
                role: 'user',
                content: data.content,
                streaming: true,
                timestamp: new Date().toISOString(),
              });
              return next;
            });
            break;

          case 'AI_PROCESSING':
            // Do not clear Waiting — stale processing must not undo AI_WAITING.
            setAiProcessing(true);
            break;

          case 'AI_WAITING':
            setAiProcessing(false);
            setAiWaiting(true);
            break;

          case 'AI_STREAMING':
            // Backend suppresses AI_STREAMING while WAITING; if it arrives, AI is speaking again.
            setAiWaiting(false);
            setAiProcessing(true);
            setSelectedCallSid(data.callSid);
            setMessages((prev) => {
              const next = [...prev];
              // Update a single in-progress assistant bubble — never append per chunk.
              for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === 'assistant' && next[i].streaming) {
                  next[i] = {
                    ...next[i],
                    content: data.content,
                    timestamp: new Date().toISOString(),
                  };
                  return next;
                }
              }
              next.push({
                role: 'assistant',
                content: data.content,
                streaming: true,
                timestamp: new Date().toISOString(),
              });
              return next;
            });
            break;

          case 'AI_RESPONSE':
            setAiProcessing(false);
            setMessages((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === 'assistant' && next[i].streaming) {
                  next[i] = {
                    role: 'assistant',
                    content: data.content,
                    streaming: false,
                    timestamp: new Date().toISOString(),
                  };
                  return next;
                }
              }
              next.push({
                role: 'assistant',
                content: data.content,
                streaming: false,
                timestamp: new Date().toISOString(),
              });
              return next;
            });
            // Do NOT soft-refresh from Mongo during live call — that reloads fragment history.
            break;

          case 'CALL_INTERRUPT':
            setAiProcessing(false);
            setAiWaiting(false);
            setMessages((prev) => {
              const next = [...prev];
              // Always remove the in-progress streaming bubble — never finalize
              // truncatedContent as a completed assistant reply.
              for (let i = next.length - 1; i >= 0; i -= 1) {
                if (next[i].role === 'assistant' && next[i].streaming) {
                  next.splice(i, 1);
                  break;
                }
              }
              next.push({
                role: 'system',
                content: data.utteranceUntilInterrupt
                  ? `Caller interrupted after: “${data.utteranceUntilInterrupt}”`
                  : 'Caller interrupted the AI.',
                timestamp: new Date().toISOString(),
              });
              return next;
            });
            break;

          case 'CALL_COMPLETED':
            setAiProcessing(false);
            setAiWaiting(false);
            setActiveCall((prev) => {
              if (prev && prev.callSid === data.callSid) {
                return null;
              }
              return prev;
            });
            refreshStats();
            refreshCalls();
            if (data.callSid === selectedCallSid) {
              loadCallDetail(data.callSid);
            }
            break;

          default:
            break;
        }
      },
    });

    return disconnect;
  }, [loadCallDetail, refreshCalls, refreshStats, selectedCallSid]);

  const displayMessages = useMemo(() => messages, [messages]);

  const memoryTurns = useMemo(
    () =>
      messages.filter((m) => m.role === 'user' || m.role === 'assistant').length,
    [messages]
  );

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>AI Voice Agent</h1>
        </div>
        {/* <div className="header-meta">
          <span className="label">Twilio Number</span>
          <span className="phone">{formatPhone(twilioNumber)}</span>
        </div> */}
      </header>

      {/* <PlanStatus
        publicLinkStatus={planInfo.publicLinkStatus}
        publicBaseUrl={planInfo.publicBaseUrl}
        geminiConfigured={planInfo.geminiConfigured}
        geminiModel={planInfo.geminiModel}
      /> */}

      <div className="dashboard-grid">
        <SystemStatus
          online={online}
          database={database}
          wsStatus={wsStatus}
        />
        <StatsCards stats={stats} />
        <OutboundDialer
          activeCallSid={
            activeCall?.direction === 'outbound' ? activeCall.callSid : null
          }
          onStarted={(result) => {
            setActiveCall({
              callSid: result.callSid,
              from: result.from,
              to: result.to,
              status: result.status || 'incoming',
              direction: 'outbound',
              startedAt: new Date().toISOString(),
            });
            setSelectedCallSid(result.callSid);
            setMessages([]);
            refreshStats();
            refreshCalls();
          }}
          onEnded={() => {
            setActiveCall(null);
            refreshStats();
            refreshCalls();
          }}
        />
        <AgentConfigPanel />
        <CallStatus
          activeCall={activeCall}
          aiProcessing={aiProcessing}
          aiWaiting={aiWaiting}
          memoryTurns={memoryTurns}
        />
        <ConversationPanel
          messages={displayMessages}
          aiProcessing={aiProcessing}
          aiWaiting={aiWaiting}
        />
        <CallDetails
          calls={calls}
          selectedCallSid={selectedCallSid}
          onSelect={setSelectedCallSid}
          onLoadMore={loadMoreCalls}
          hasMore={callsHasMore}
          loadingMore={callsLoadingMore}
        />
      </div>

      {/* <footer className="dashboard-footer">
        Developed by Tinkal
      </footer> */}
    </div>
  );
}

export default Dashboard;
