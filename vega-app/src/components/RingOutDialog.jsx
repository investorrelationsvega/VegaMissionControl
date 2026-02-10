// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — RingOut Dialog
// Call progress modal for click-to-dial
// ═══════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import useRingCentralStore from '../stores/ringcentralStore';
import { initiateRingOut, getRingOutStatus, cancelRingOut, formatPhoneForDisplay } from '../services/ringcentralService';

const mono = { fontFamily: "'Space Mono', monospace" };

const STATUS_LABELS = {
  InProgress: 'Ringing...',
  Success: 'Connected',
  CannotReach: 'Cannot Reach',
  NoAnswer: 'No Answer',
  Rejected: 'Rejected',
  Busy: 'Busy',
  Error: 'Error',
};

const STATUS_COLORS = {
  InProgress: 'var(--ylw)',
  Success: 'var(--grn)',
  CannotReach: 'var(--red)',
  NoAnswer: 'var(--red)',
  Rejected: 'var(--red)',
  Busy: 'var(--ylw)',
  Error: 'var(--red)',
};

export default function RingOutDialog({ to, toName, onClose }) {
  const accessToken = useRingCentralStore((s) => s.accessToken);
  const userPhoneNumber = useRingCentralStore((s) => s.userPhoneNumber);
  const setActiveCall = useRingCentralStore((s) => s.setActiveCall);

  const [status, setStatus] = useState('initiating'); // initiating | InProgress | Success | error
  const [ringOutId, setRingOutId] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  // Start the call
  useEffect(() => {
    if (!accessToken || !to) return;

    const fromNumber = userPhoneNumber || '';

    initiateRingOut(accessToken, { from: fromNumber, to })
      .then((data) => {
        setRingOutId(data.id);
        setStatus(data.status?.callStatus || 'InProgress');
        setActiveCall({ id: data.id, to, toName, startedAt: Date.now() });
      })
      .catch((err) => {
        setStatus('Error');
        setError(err.message || 'Failed to initiate call');
      });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [accessToken, to]);

  // Poll for status
  useEffect(() => {
    if (!ringOutId || !accessToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await getRingOutStatus(accessToken, ringOutId);
        const callStatus = data.status?.callStatus;
        if (callStatus) {
          setStatus(callStatus);
        }

        // Stop polling when call is no longer in progress
        if (callStatus && callStatus !== 'InProgress') {
          clearInterval(pollRef.current);
          pollRef.current = null;

          // Clear active call after a delay
          setTimeout(() => {
            setActiveCall(null);
          }, 3000);
        }
      } catch {
        // Silently handle poll errors
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ringOutId, accessToken]);

  // Elapsed timer
  useEffect(() => {
    if (status === 'InProgress' || status === 'Success') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleCancel = async () => {
    if (ringOutId && accessToken) {
      try {
        await cancelRingOut(accessToken, ringOutId);
      } catch {
        // Best effort cancel
      }
    }
    setActiveCall(null);
    onClose();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isTerminal = status !== 'initiating' && status !== 'InProgress' && status !== 'Success';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={isTerminal ? onClose : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#0f172a',
            border: '1px solid var(--bdH)',
            borderRadius: 10,
            padding: 32,
            width: 340,
            textAlign: 'center',
            boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Phone Icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: status === 'InProgress'
                ? 'var(--ylwM)'
                : status === 'Success'
                ? 'var(--grnM)'
                : status === 'Error' || isTerminal
                ? 'var(--redM)'
                : 'rgba(51,65,85,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              transition: 'background 0.3s',
            }}
          >
            <svg viewBox="0 0 24 24" style={{
              width: 24,
              height: 24,
              fill: STATUS_COLORS[status] || 'var(--t3)',
              transition: 'fill 0.3s',
            }}>
              <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 300,
              color: 'var(--t1)',
              marginBottom: 4,
            }}
          >
            {toName || formatPhoneForDisplay(to)}
          </div>

          {/* Phone number */}
          <div
            style={{
              ...mono,
              fontSize: 12,
              color: 'var(--t4)',
              marginBottom: 16,
            }}
          >
            {formatPhoneForDisplay(to)}
          </div>

          {/* Status */}
          <div
            style={{
              ...mono,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: STATUS_COLORS[status] || 'var(--t3)',
              marginBottom: 8,
            }}
          >
            {status === 'initiating' ? 'Initiating...' : STATUS_LABELS[status] || status}
          </div>

          {/* Timer */}
          {(status === 'InProgress' || status === 'Success') && (
            <div
              style={{
                ...mono,
                fontSize: 24,
                fontWeight: 300,
                color: 'var(--t2)',
                marginBottom: 20,
              }}
            >
              {formatTime(elapsed)}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--red)',
                marginBottom: 16,
                padding: '8px 12px',
                background: 'var(--redM)',
                borderRadius: 4,
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            {!isTerminal && (
              <button
                onClick={handleCancel}
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '10px 24px',
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'var(--redM)',
                  color: 'var(--red)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {status === 'initiating' ? 'Cancel' : 'End Call'}
              </button>
            )}
            {isTerminal && (
              <button
                onClick={onClose}
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '10px 24px',
                  border: '1px solid var(--bd)',
                  background: 'transparent',
                  color: 'var(--t3)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
