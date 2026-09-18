import React, { useEffect, useState } from 'react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {
  hangupOutboundCall,
  startOutboundCall,
} from '../services/api.js';

/**
 * react-phone-input-2 stores digits without '+'. Convert to E.164.
 * @param {string} value
 * @returns {{ ok: true, e164: string } | { ok: false, error: string }}
 */
export function toE164FromPhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return { ok: false, error: 'Enter a phone number' };
  }
  const e164 = `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    return {
      ok: false,
      error: 'Enter a valid phone number for the selected country',
    };
  }
  return { ok: true, e164 };
}

function OutboundDialer({ onStarted, activeCallSid, onEnded }) {
  // Library value: digits only, e.g. "919876543210" (no leading +)
  const [phoneValue, setPhoneValue] = useState('');
  const [state, setState] = useState('idle'); // idle | calling | connected | failed
  const [error, setError] = useState('');
  const [callSid, setCallSid] = useState(null);
  const [hint, setHint] = useState('');

  const liveSid = activeCallSid || callSid;
  const showEnd =
    liveSid && (state === 'calling' || state === 'connected' || activeCallSid);

  // Remote hangup (mobile End) clears parent activeCallSid → reset dialer UI.
  useEffect(() => {
    if (!activeCallSid && callSid) {
      setState('idle');
      setCallSid(null);
      setError('');
    }
  }, [activeCallSid, callSid]);

  // Parent still has an active outbound call → show Connected.
  useEffect(() => {
    if (activeCallSid) {
      setCallSid(activeCallSid);
      setState((prev) => (prev === 'failed' ? prev : 'connected'));
    }
  }, [activeCallSid]);

  function handlePhoneChange(value) {
    setPhoneValue(value || '');
    setError('');
    const parsed = toE164FromPhoneInput(value);
    if (parsed.ok) {
      // setHint(`Will dial ${parsed.e164}`);
    } else if (!value) {
      setHint('');
    } else {
      setHint('Select country, then enter the local number');
    }
  }

  async function handleCall(event) {
    event.preventDefault();
    setError('');
    const parsed = toE164FromPhoneInput(phoneValue);
    if (!parsed.ok) {
      setState('failed');
      setError(parsed.error);
      return;
    }

    setState('calling');
    setHint(`Dialing ${parsed.e164}…`);
    try {
      const result = await startOutboundCall(parsed.e164);
      setCallSid(result.callSid);
      setState('calling');
      if (onStarted) {
        onStarted(result);
      }
    } catch (err) {
      setState('failed');
      setError(err.message || 'Outbound call failed');
    }
  }

  async function handleHangup() {
    if (!liveSid) return;
    setError('');
    try {
      await hangupOutboundCall(liveSid);
      setState('idle');
      setCallSid(null);
      setHint('');
      if (onEnded) {
        onEnded(liveSid);
      }
    } catch (err) {
      setState('failed');
      setError(err.message || 'Hangup failed');
    }
  }

  const displayState =
    activeCallSid && state !== 'failed' ? 'connected' : state;
  const inputLocked =
    displayState === 'calling' || displayState === 'connected';
  const canCall = toE164FromPhoneInput(phoneValue).ok && !inputLocked;

  return (
    <section className="panel outbound-dialer">
      <h2>Outbound Call</h2>
      <form className="outbound-form" onSubmit={handleCall}>
        <label htmlFor="outbound-phone">Phone Number</label>
        <div className="phone-input-wrap">
          <PhoneInput
            inputProps={{
              id: 'outbound-phone',
              name: 'phone',
              required: true,
              autoComplete: 'tel',
            }}
            country="in"
            preferredCountries={['in', 'us', 'gb', 'au']}
            value={phoneValue}
            onChange={handlePhoneChange}
            enableSearch
            disableSearchIcon={false}
            searchPlaceholder="Search country…"
            countryCodeEditable={false}
            disabled={inputLocked}
            placeholder="9876543210"
            containerClass="outbound-phone-container"
            inputClass="outbound-phone-input"
            buttonClass="outbound-phone-button"
            dropdownClass="outbound-phone-dropdown"
            searchClass="outbound-phone-search"
          />
        </div>
        {hint && !error ? <p className="outbound-hint">{hint}</p> : null}
        <div className="outbound-actions">
          <button type="submit" className="btn-primary" disabled={!canCall}>
            Call
          </button>
          {showEnd ? (
            <button
              type="button"
              className="btn-danger"
              onClick={handleHangup}
            >
              End Call
            </button>
          ) : null}
        </div>
      </form>
      <p className={`outbound-state state-${displayState}`}>
        {displayState === 'idle' && 'Ready'}
        {displayState === 'calling' && 'Calling…'}
        {displayState === 'connected' && 'Connected'}
        {displayState === 'failed' && 'Failed'}
      </p>
      {error ? <p className="outbound-error">{error}</p> : null}
    </section>
  );
}

export default OutboundDialer;
