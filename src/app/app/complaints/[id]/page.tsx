import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/session';
import { getComplaint, type CaseStatus } from '@/services/complaints';
import { AppError } from '@/lib/errors';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { deskAction_ } from '../../actions';

export default async function ComplaintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
  const { locale, t } = await getT();
  const data = await getComplaint(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  });
  const { complaint: c, messages, editors, claims } = data;
  const lang = LOCALE_META[c.language as Locale]?.htmlLang;
  const Hidden = ({ action }: { action: string }) => (<><input type="hidden" name="complaintId" value={c.id} /><input type="hidden" name="action" value={action} /></>);
  const highlighted = c.version_body.replace(c.passage, `⟦${c.passage}⟧`);
  return (
    <div>
      <p className="eyebrow"><a href="/app/complaints">{t('app.complaints')}</a></p>
      <h1 className="mono" style={{ fontFamily: 'inherit' }}>{c.case_ref}</h1>
      <ErrorBanner error={error} />
      <div className="grid two">
        <div className="card">
          <dl className="meta">
            <dt>Status</dt><dd><span className="pill">{t(`case.status.${c.status as CaseStatus}`)}</span></dd>
            <dt>{t('app.assigned')}</dt><dd>{c.assigned ?? '—'}</dd>
            <dt>{t('app.channelLabel')}</dt><dd>{c.intake_channel === 'whatsapp' ? 'WhatsApp' : 'Web'} · {LANGUAGE_LABEL[c.locale as Locale]}</dd>
            <dt>Received</dt><dd>{formatDate(c.created_at, locale)}</dd>
            <dt>{t('app.lastActivity')}</dt><dd>{formatDate(c.last_activity_at, locale)}</dd>
            <dt>Service target</dt><dd>{c.response_target_hours} hours (newsroom-configured, not a statutory deadline)</dd>
            <dt>Disputed version</dt><dd><a className="mono" href={`/p/${c.public_ref}`}>{c.public_ref}</a> · v{c.seq} · {c.output_title}</dd>
            {c.complainant_accepts !== null && (<><dt>Complainant</dt><dd>{c.complainant_accepts ? 'Considers it addressed' : 'Does not consider it addressed'}</dd></>)}
          </dl>
        </div>
        <div className="card soft">
          <h3 style={{ marginTop: 0 }}>{t('case.disputed')}</h3>
          <blockquote className="content" lang={lang}>{c.passage}</blockquote>
          <h3>{t('case.concern')}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.concern}</p>
          {c.evidence_url && <p className="small">Evidence (private): <a href={c.evidence_url} rel="noreferrer noopener" target="_blank">{c.evidence_url}</a></p>}
        </div>
      </div>
      <details className="card"><summary>Registered content</summary><div className="content small" lang={lang}>{highlighted}</div></details>

      <h2>Conversation</h2>
      <ol style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m, i) => (
          <li key={i} className="card" style={{ margin: '6px 0', padding: 12, borderStyle: m.visibility === 'internal' ? 'dashed' : 'solid' }}>
            <p className="small muted" style={{ margin: 0 }}>
              {m.author_kind}{m.display_name ? ` · ${m.display_name}` : ''} · {formatDate(m.created_at, locale)} · {m.visibility === 'internal' ? 'INTERNAL NOTE' : 'shared with complainant'}
            </p>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid two">
        <form action={deskAction_} className="card">
          <Hidden action="assign" />
          <label htmlFor="editor">{t('app.assigned')}</label>
          <select id="editor" name="editorId" defaultValue={c.assigned_editor_id ?? ''}>
            {editors.map((e) => <option key={e.id} value={e.id}>{e.display_name}</option>)}
          </select>
          <div className="actions"><button type="submit" className="secondary">Assign</button></div>
        </form>
        <div className="card">
          <p style={{ marginTop: 0 }}><strong>Propose a correction</strong> from this complaint</p>
          <div className="actions">
            {claims.map((cl) => (
              <a key={cl.id} className="btn secondary" href={`/app/corrections/new?story=${c.story_id}&claim=${cl.id}&complaint=${c.id}`}>{cl.label}</a>
            ))}
            <a className="btn secondary" href={`/app/corrections/new?story=${c.story_id}&complaint=${c.id}`}>Editorial</a>
          </div>
          {c.correction_id && <p className="small"><a href={`/app/corrections/${c.correction_id}`}>Linked correction</a></p>}
        </div>
      </div>

      {[
        { action: 'reply', label: 'Reply to complainant (shared)' },
        { action: 'request_info', label: 'Request information (shared; status: awaiting information)' },
        { action: 'note', label: 'Internal note (never shared)' },
        { action: 'decide', label: 'Issue decision (shared; e.g. correction published, or declined with reasons)' },
        { action: 'close', label: 'Close case (optional closing message, shared)' },
      ].map((f) => (
        <form key={f.action} action={deskAction_} className="card">
          <Hidden action={f.action} />
          <label htmlFor={`m-${f.action}`}>{f.label}</label>
          <textarea id={`m-${f.action}`} name="body" required={f.action !== 'close'} style={{ minHeight: 70 }} />
          <div className="actions"><button type="submit" className={f.action === 'note' ? 'secondary' : undefined}>Send</button></div>
        </form>
      ))}
    </div>
  );
}
