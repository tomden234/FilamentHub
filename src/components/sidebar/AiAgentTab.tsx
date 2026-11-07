import React from 'react';
import { Sparkles } from 'lucide-react';
import type { ChatMessage } from './useAgentChat';

interface AiAgentTabProps {
  setAiInput: any;
  chatMessages: ChatMessage[];
  handleAiSubmit: (...args: any[]) => any;
  aiInput: any;
}

export const AiAgentTab: React.FC<AiAgentTabProps> = ({
  setAiInput,
  chatMessages,
  handleAiSubmit,
  aiInput
}) => {
  return (
<div className="space-y-3">
              <div
                className="rounded-xl border p-3 space-y-2 transition-colors"
                style={{
                  backgroundColor: 'var(--app-card-sub)',
                  borderColor: 'var(--app-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>FilamentHub KI-Assistent</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                    Bereit
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
                  Läuft im Gerät, auch offline. Versteht freie Sätze, fragt nach, wenn mehrere Spulen passen. „Hilfe“ zeigt alles.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    'Was ist fast leer?',
                    'Was muss getrocknet werden?',
                    'Wie viel PLA habe ich?',
                    'Was ist mein Filament wert?',
                    'Wo kann ich sparen?',
                    'Zieh 50 g von Bambu Weiß ab',
                    'Hilfe'
                  ].map(chip => (
                    <button
                      key={chip}
                      onClick={() => setAiInput(chip)}
                      className="px-2 py-1 rounded-md border text-[10px] cursor-pointer transition"
                      style={{
                        backgroundColor: 'var(--app-card)',
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text)'
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat-Verlauf */}
              <div
                className="rounded-xl border p-3 h-56 overflow-y-auto space-y-2 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--app-input-bg)',
                  borderColor: 'var(--app-border)'
                }}
              >
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 leading-relaxed text-xs ${
                        msg.isUser
                          ? 'bg-orange-500 text-white rounded-br-none'
                          : 'rounded-bl-none border'
                      }`}
                      style={
                        !msg.isUser
                          ? {
                              backgroundColor: 'var(--app-card)',
                              borderColor: 'var(--app-border)',
                              color: 'var(--app-text)'
                            }
                          : undefined
                      }
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] mt-0.5 px-1" style={{ color: 'var(--app-text-muted)' }}>
                      {msg.timestamp}
                    </span>
                  </div>
                ))}
              </div>

              {/* Chat-Eingabe */}
              <form onSubmit={handleAiSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Befehl oder Frage eingeben..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    borderColor: 'var(--app-border)',
                    color: 'var(--app-text)'
                  }}
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-orange-500/20"
                >
                  Senden
                </button>
              </form>
            </div>
  );
};
