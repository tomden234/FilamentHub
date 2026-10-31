// Welche Mitteilungen gehen als Push aufs Gerät? Alle anderen landen nur im Postfach (und als Einblendung in der App).
import type { InboxKind } from './inbox';

export const PUSH_KINDS: ReadonlySet<InboxKind> = new Set<InboxKind>(['print-done', 'print-fail', 'printer-error', 'dry-done']);

/** systemPush = Hauptschalter, pushAll = „auch weniger wichtige“ */
export function shouldPush(kind: InboxKind, opts: { systemPush: boolean; pushAll: boolean }): boolean {
  return opts.systemPush && (PUSH_KINDS.has(kind) || opts.pushAll);
}
