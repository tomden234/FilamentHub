import React, { useRef, useState } from 'react';
import { runAssistant, type AssistantMemory } from '../../utils/assistant';
import { isAppShell } from '../../utils/env';
import { useWorkshopSettings } from '../../utils/workshopSettings';
import type { SidebarProps as ParentProps } from '../Sidebar';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

interface useAgentChatParams {
  spools: ParentProps['spools'];
  onOpenCamera: ParentProps['onOpenCamera'];
  onSetViewMode: ParentProps['onSetViewMode'];
  versionProfiles: ParentProps['versionProfiles'];
  onSelectVersion: ParentProps['onSelectVersion'];
  setActiveTab: any;
  appSettings: ParentProps['appSettings'];
  onMarkDried: ParentProps['onMarkDried'];
  onDeductWeight: ParentProps['onDeductWeight'];
  onAddWeight?: (spoolId: string, grams: number) => void;
}

export function useAgentChat({ spools, onOpenCamera, onSetViewMode, versionProfiles, onSelectVersion, setActiveTab, appSettings, onMarkDried, onDeductWeight, onAddWeight }: useAgentChatParams) {
  const [aiInput, setAiInput] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: `Hallo! Ich kenne alle deine ${spools.length} Spulen und Standardwerte. Frag mich z. B. „Was ist fast leer?“, „Wie viel PLA habe ich?“ oder sag „Zieh 30 g von Bambu Weiß ab“. „Hilfe“ zeigt alles.`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [settings] = useWorkshopSettings();
  const memory = useRef<AssistantMemory>({});

  const handleAiSubmit = (e?: React.FormEvent, direct?: string) => {
    if (e) e.preventDefault();
    const prompt = (direct ?? aiInput).trim();
    if (!prompt) return;
    const time = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { id: 'usr-' + Date.now(), text: prompt, isUser: true, timestamp: time() }]);
    setAiInput('');

    const res = runAssistant(
      prompt,
      { spools, noGcode: isAppShell(), lowWeightG: settings.lowWeightG || 100, eibosTara: appSettings?.eibosBagTara, versions: versionProfiles.map(v => ({ id: v.id, label: v.label })) },
      memory.current
    );
    memory.current = res.memory;
    for (const a of res.actions) {
      if (a.type === 'deduct') onDeductWeight(a.spoolId, a.grams);
      else if (a.type === 'add') (onAddWeight ? onAddWeight(a.spoolId, a.grams) : undefined);
      else if (a.type === 'dried') onMarkDried(a.spoolId);
      else if (a.type === 'camera') onOpenCamera();
      else if (a.type === 'view') onSetViewMode(a.mode);
      else if (a.type === 'tab') setActiveTab(a.tab);
      else if (a.type === 'version') onSelectVersion(a.id);
    }
    setTimeout(() => {
      setChatMessages(prev => [...prev, { id: 'bot-' + Date.now(), text: res.reply, isUser: false, timestamp: time() }]);
    }, 150);
  };

  return { setAiInput, chatMessages, handleAiSubmit, aiInput };
}
