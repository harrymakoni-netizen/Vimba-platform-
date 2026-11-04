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
      {m.type === 'list' && <div className="small muted" style={{ marginTop: 6 }}>{m.button}</div>}
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
      <p className="sim-banner" role="note">{t('app.simBanner')}</p>
      <p className="small muted">
        {t('app.simTry')}: <code>MENU</code>, <code>MHORO</code>, <code>SALIBONANI</code>, <code>CHECK VMB-5DSN6ZBGGZ</code>, <code>HLOLA VMB-WWYFCTP00H</code>, <code>TARISA VMB-2N2P3KWETY</code>, <code>TRACK</code>
      </p>
      <div className="card">
        <div className="chat" aria-live="polite">
          {items.map((it, i) =>
            it.dir === 'in' ? (
              <div key={i} className="bubble in">{it.text ?? `[${it.choiceId}]`}</div>
            ) : (
              <div key={i} className="bubble out">
                {it.message.body}
                {items.slice(i + 1).every((x) => x.dir === 'out') ? <Options m={it.message} /> : null}
              </div>
            ),
          )}
          {!items.length && <p className="muted">{t('app.simEmpty')}</p>}
        </div>
        <form action={simulatorAction} className="actions">
          <label htmlFor="text" className="sr-only">{t('app.simPlaceholder')}</label>
          <input id="text" name="text" type="text" placeholder={t('app.simPlaceholder')} autoComplete="off" style={{ flex: 1, minWidth: 200 }} />
          <button type="submit">{t('app.send')}</button>
          <button type="submit" name="reset" value="1" className="secondary">{t('app.simNewSender')}</button>
        </form>
      </div>
    </div>
  );
}
