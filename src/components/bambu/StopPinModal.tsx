import React from 'react';
import { AlertTriangle, X, RefreshCw, Square } from 'lucide-react';
import { useEscapeClose } from '../../hooks/useEscapeClose';

interface StopPinModalProps {
  setShowStopPinModal: any;
  setAdminPinInput: any;
  adminPinInput: any;
  handleSendCommand: (...args: any[]) => any;
  actionLoading: any;
}

export const StopPinModal: React.FC<StopPinModalProps> = ({
  setShowStopPinModal,
  setAdminPinInput,
  adminPinInput,
  handleSendCommand,
  actionLoading
}) => {
  useEscapeClose(() => setShowStopPinModal(false));
  return (
<div
          onClick={() => setShowStopPinModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl space-y-4"
            style={{
              backgroundColor: 'var(--app-card)',
              borderColor: 'var(--app-border)',
              color: 'var(--app-text)'
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="font-extrabold text-sm">Druck wirklich abbrechen?</h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStopPinModal(false);
                  setAdminPinInput('');
                }}
                className="cursor-pointer p-1 rounded-lg hover:opacity-75 transition"
                style={{ color: 'var(--app-text-muted)' }}
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Der laufende Druckauftrag auf deinem Bambu Lab X2D wird sofort gestoppt. Bitte gib zur Bestätigung die Admin-PIN ein:
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold block" style={{ color: 'var(--app-text)' }}>
                Admin-PIN (Standard: 1234):
              </label>
              <input
                type="password"
                maxLength={8}
                placeholder="1234"
                autoFocus
                value={adminPinInput}
                onChange={e => setAdminPinInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendCommand('stop', adminPinInput);
                }}
                className="w-full px-3 py-2 rounded-xl border text-sm font-mono-num font-bold tracking-widest text-center outline-none"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowStopPinModal(false);
                  setAdminPinInput('');
                }}
                className="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text)'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleSendCommand('stop', adminPinInput)}
                disabled={Boolean(actionLoading)}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                {actionLoading === 'stop' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                <span>Druck stoppen</span>
              </button>
            </div>
          </div>
        </div>
  );
};
