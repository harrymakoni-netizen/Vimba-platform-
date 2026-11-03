import { requireActor } from '@/lib/session';
import { listRelay } from '@/services/relay';
import { getT } from '@/lib/i18n/server';
import { formatDate, LOCALE_META, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { relayAction } from '../actions';

export default async function RelayPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { error } = await searchParams;
  const { locale, t } = await getT();
  const { incoming, outgoing } = await listRelay(actor);
  return (
    <div>
      <h1>{t('app.relay')}</h1>
      <p className="muted">Correction notices from origin newsrooms about copies you republished. You control your own copy: Vimba never edits a partner&apos;s publication.</p>
      <ErrorBanner error={error} />
      {incoming.map((r) => {
        const open = ['pending', 'sent', 'acknowledged'].includes(r.status);
        const lang = LOCALE_META[r.language as Locale]?.htmlLang;
        return (
          <section key={r.id} className="card">
            <h2 style={{ marginTop: 0 }}>From {r.origin_name} <span className="pill">{r.status}</span></h2>
            <p className="small muted">{formatDate(r.created_at, locale)} · your copy: <a className="mono" href={`/p/${r.partner_ref}`}>{r.partner_ref}</a></p>
            <div className="card soft content small">{r.public_evidence}</div>
            {r.completed_ref && <p className="notice ok">Completed with your version <a className="mono" href={`/p/${r.completed_ref}`}>{r.completed_ref}</a></p>}
            {r.response_note && <p className="small">Note: {r.response_note}</p>}
            {open && (
              <>
                {r.status !== 'acknowledged' && (
                  <form action={relayAction} className="actions">
                    <input type="hidden" name="relayId" value={r.id} />
                    <button type="submit" name="action" value="acknowledge" className="secondary">{t('app.acknowledge')}</button>
                  </form>
                )}
                <details open={r.status === 'acknowledged'}>
                  <summary>{t('app.complete')}</summary>
                  <form action={relayAction}>
                    <input type="hidden" name="relayId" value={r.id} />
                    <input type="hidden" name="action" value="complete" />
                    <input type="hidden" name="baseVersionId" value={r.partner_version_id ?? ''} />
                    <label htmlFor={`t-${r.id}`}>Title</label>
                    <input id={`t-${r.id}`} name="title" type="text" defaultValue={r.partner_title} lang={lang} required />
                    <label htmlFor={`b-${r.id}`}>Your corrected copy</label>
                    <textarea id={`b-${r.id}`} name="body" defaultValue={r.draft_body} lang={lang} rows={6} required />
                    <label htmlFor={`n-${r.id}`}>Change note</label>
                    <input id={`n-${r.id}`} name="changeNote" type="text" lang={lang} required />
                    <div className="actions"><button type="submit">{t('app.complete')}</button></div>
                  </form>
                </details>
                <details>
                  <summary>{t('app.decline')}</summary>
                  <form action={relayAction}>
                    <input type="hidden" name="relayId" value={r.id} />
                    <input type="hidden" name="action" value="decline" />
                    <label htmlFor={`d-${r.id}`}>Reason</label>
                    <textarea id={`d-${r.id}`} name="note" required style={{ minHeight: 70 }} />
                    <div className="actions"><button type="submit" className="danger">{t('app.decline')}</button></div>
                  </form>
                </details>
              </>
            )}
          </section>
        );
      })}
      {!incoming.length && <p className="muted">No incoming requests.</p>}
      <h2>Sent to partners</h2>
      <ul>{outgoing.map((o) => <li key={o.id}>{o.recipient_name}: <span className="pill">{o.status}</span> · {formatDate(o.updated_at, locale)}{o.response_note && ` · ${o.response_note}`}</li>)}</ul>
      {!outgoing.length && <p className="muted">None.</p>}
    </div>
  );
}
