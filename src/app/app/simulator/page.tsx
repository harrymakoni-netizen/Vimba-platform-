import { cookies } from 'next/headers';
import { requireActor } from '@/lib/session';
import { simulatorTranscript } from '@/channels/whatsapp/handler';
import type { OutMessage } from '@/channels/whatsapp/conversation';
import { getT } from '@/lib/i18n/server';
import { simulatorAction } from '../actions';

export const dynamic = 'force-dynamic';

function Options({ m }: { m: OutMessage }) {
  const opts = m.type === 'buttons' ? m.buttons : m.type === 'list' ? m.rows : [];
  return (
    <>
      {m.type === 'list' && <div className="small muted" style={{ marginTop: 6 }}>[{m.button}]</div>}
      {opts.length > 0 && (
        <form action={simulatorAction} className="opts">
          {opts.map((o) => <button key={o.id} type="submit" name="choiceId" value={o.id} className="secondary">{o.title}</button>)}
        </form>
      )}
      {m.type === 'cta' && <div className="opts"><a className="btn secondary" href={m.url}>{m.label}</a></div>}
    </>
  );
}

export default async function SimulatorPage() {
  await requireActor();
  const { t } = await getT();
  const sim = (await cookies()).get('vimba_sim')?.value;
  const items = sim ? await simulatorTranscript(sim) : [];
  return (
    <div>
      <h1>{t('app.simulator')}</h1>
      <p className="sim-banner" role="note">
        SIMULATOR — this is not WhatsApp. It runs the same conversation logic and complaint services as the real Kapso
        webhook, but a simulated chat is not evidence of a completed WhatsApp integration.
      </p>
      <p className="small muted">Try: <code>MENU</code>, <code>MHORO</code> (Shona), <code>SALIBONANI</code> (Ndebele), <code>CHECK VMB-…</code>, <code>HLOLA VMB-…</code>, <code>TRACK</code>, <code>STOP</code>.</p>
      <div className="card">
        <div className="chat" aria-live="polite">
          {items.map((it, i) =>
            it.dir === 'in' ? (
              <div key={i} className="bubble in">{it.text ?? `[${it.choiceId}]`}</div>
            ) : (
              <div key={i} className="bubble out">
                {it.message.body}
                {i === items.length - 1 || items.slice(i + 1).every((x) => x.dir === 'out') ? <Options m={it.message} /> : null}
              </div>
            ),
          )}
          {!items.length && <p className="muted">Send a message to start.</p>}
        </div>
        <form action={simulatorAction} className="actions">
          <label htmlFor="text" className="sr-only" style={{ margin: 0 }}>Message</label>
          <input id="text" name="text" type="text" placeholder="Type a message" autoComplete="off" style={{ flex: 1, minWidth: 200 }} />
          <button type="submit">Send</button>
          <button type="submit" name="reset" value="1" className="secondary">New simulated sender</button>
        </form>
      </div>
    </div>
  );
}
