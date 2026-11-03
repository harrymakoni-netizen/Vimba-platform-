import { describe, expect, it } from 'vitest';
import { LOCALES, packs, translator, type MessageKey } from '@/lib/i18n';
import { menu } from '@/channels/whatsapp/conversation';

const all = packs();
const keys = Object.keys(all.en) as MessageKey[];
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(',');

describe('language packs', () => {
  it.each(LOCALES)('%s has every key, non-empty', (l) => {
    for (const k of keys) expect(all[l][k], `${l}:${k}`).toBeTruthy();
  });
  it.each(LOCALES)('%s keeps placeholders identical to English', (l) => {
    for (const k of keys) expect(placeholders(all[l][k]), `${l}:${k}`).toBe(placeholders(all.en[k]));
  });
  it.each(LOCALES)('%s keeps WhatsApp interactive limits', (l) => {
    const t = translator(l);
    const m = menu(t);
    if (m.type !== 'list') throw new Error('menu must be a list');
    expect(m.button.length).toBeLessThanOrEqual(20);
    expect(m.rows.length).toBeLessThanOrEqual(10);
    for (const r of m.rows) {
      expect(r.title.length, `${l}:${r.title}`).toBeLessThanOrEqual(24);
      expect((r.description ?? '').length).toBeLessThanOrEqual(72);
    }
    for (const k of ['wa.skip', 'wa.confirm.submit', 'wa.confirm.edit', 'wa.confirm.cancel', 'wa.openPassport'] as const) {
      expect(t(k).length, `${l}:${k}`).toBeLessThanOrEqual(20);
    }
  });
});
