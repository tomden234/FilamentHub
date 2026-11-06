import React from 'react';
import { RefreshCw, Download, Upload, Database, Trash2, Cloud, ShieldAlert } from 'lucide-react';
import type { SidebarProps as ParentProps } from '../Sidebar';
import { safeStorage } from '../../utils/safeStorage';
import { isGistUrl } from '../../utils/gistStore';
import { isPiUrl } from '../../utils/piDoc';
import { STORAGE_KEY_CLOUD_URL } from '../../utils/storageKeys';

export interface ToolsTabProps {
  /** Windows-App/Browser: mit Backup und Beispiel-Spulen. Android-App: nur Abgleich und Bestand. */
  full?: boolean;
  onSyncCloud: ParentProps['onSyncCloud'];
  onExportBackup: ParentProps['onExportBackup'];
  onImportBackup: ParentProps['onImportBackup'];
  onRestoreDefaultSpools: ParentProps['onRestoreDefaultSpools'];
  onClearAllSpools: ParentProps['onClearAllSpools'];
}

const card: React.CSSProperties = { backgroundColor: 'var(--app-card-sub)', borderColor: 'var(--app-border)' };
const muted: React.CSSProperties = { color: 'var(--app-text-muted)' };

const Item: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  hint: string;
  onClick?: () => void;
  as?: 'button' | 'label';
  children?: React.ReactNode;
  danger?: boolean;
}> = ({ icon: Icon, tone, title, hint, onClick, as = 'button', children, danger }) => {
  const cls = `w-full flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition active:scale-[0.99] hover:opacity-90 ${danger ? 'border-rose-500/30' : ''}`;
  const style: React.CSSProperties = danger ? { backgroundColor: 'rgba(244,63,94,0.08)' } : { backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' };
  const inner = (
    <>
      <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="w-4.5 h-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold" style={{ color: danger ? undefined : 'var(--app-text)' }}>
          {title}
        </span>
        <span className="block text-[11px] leading-snug" style={muted}>
          {hint}
        </span>
      </span>
      {children}
    </>
  );
  return as === 'label' ? (
    <label className={cls} style={style}>
      {inner}
    </label>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {inner}
    </button>
  );
};

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h4 className="text-[10px] font-extrabold uppercase tracking-wider px-1" style={muted}>
      {title}
    </h4>
    <div className="rounded-2xl border p-2 space-y-1.5" style={card}>
      {children}
    </div>
  </section>
);

export const ToolsTab: React.FC<ToolsTabProps> = ({ full = true, onSyncCloud, onExportBackup, onImportBackup, onRestoreDefaultSpools, onClearAllSpools }) => {
  const gist = isGistUrl(safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '');
  const pi = isPiUrl(safeStorage.getItem(STORAGE_KEY_CLOUD_URL) || '');
  return (
    <div className="space-y-4">
      <Group title="Abgleich">
        <Item icon={RefreshCw} tone="text-sky-400 bg-sky-500/15 border-sky-500/30" title="Jetzt mit der Cloud abgleichen" hint={pi ? 'Pi-Server (SSD)' : gist ? 'Privater GitHub-Gist' : 'npoint.io (alt)'} onClick={onSyncCloud}>
          <Cloud className="w-4 h-4 shrink-0 opacity-50" />
        </Item>
      </Group>

      {full && (
      <Group title="Backup">
        <Item icon={Download} tone="text-emerald-400 bg-emerald-500/15 border-emerald-500/30" title="Backup herunterladen" hint="Alle Spulen, Verlauf und Einstellungen als JSON-Datei" onClick={onExportBackup} />
        <Item icon={Upload} tone="text-amber-400 bg-amber-500/15 border-amber-500/30" title="Backup wiederherstellen" hint="JSON-Datei auswählen" as="label">
          <input
            type="file"
            accept=".json"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onImportBackup(f);
            }}
            className="hidden"
          />
        </Item>
      </Group>
      )}

      <Group title="Spulenbestand">
        {full && (
        <Item
          icon={Database}
          tone="text-slate-400 bg-slate-500/15 border-slate-500/30"
          title="21 Beispiel-Spulen laden"
          hint="Ersetzt deine Liste. Oben auf „Zurück“ bringt sie wieder."
          onClick={() => {
            if (confirm('21 Beispiel-Spulen laden? Deine jetzige Liste wird ersetzt (oben auf „Zurück“ bringt sie wieder).')) onRestoreDefaultSpools();
          }}
        />
        )}
        <Item
          icon={Trash2}
          tone="text-rose-400 bg-rose-500/15 border-rose-500/30"
          title="Alle Spulen entfernen (Neustart)"
          hint="Mit Backup-Datei und Kopie im Gerät. Verlauf bleibt."
          danger
          onClick={() => {
            if (confirm('ALLE Spulen entfernen?\n\nVorher wird eine Backup-Datei geladen und eine Kopie im Gerät gesichert. Verlauf bleibt. AMS- und Tag-Zuordnungen werden geleert. Oben auf „Zurück“ stellt alles wieder her.')) onClearAllSpools();
          }}
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 opacity-70" />
        </Item>
      </Group>
    </div>
  );
};
