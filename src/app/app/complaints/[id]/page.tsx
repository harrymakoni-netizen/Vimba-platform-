import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/session';
import { getComplaint, type CaseStatus } from '@/services/complaints';
import { AppError } from '@/lib/errors';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, LOCALE_META, renderSystemMessage, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { deskAction_ } from '../../actions';

const ACTIONS = ['reply', 'request_info', 'note', 'decide', 'close'] as const;

export default async function ComplaintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
  const { locale, t } = await getT();
  const data = await getComplaint(actor, id).catch((e) => {
    if (e instanceof AppError && (e.code === 'not_found' || e.code === 'forbidden')) notFound();
    throw e;
  });
  const { complaint: c, photos, messages, editors, claims } = data;
  const lang = LOCALE_META[c.language as Locale]?.htmlLang;
  const Hidden = ({ action }: { action: string }) => (
    <>
      <input type="hidden" name="complaintId" value={c.id} />
      <input type="hidden" name="action" value={action} />
    </>
  );
  return (
    <div>
      <p className="eyebrow"><a href="/app/complaints">{t('app.complaints')}</a></p>
      <h1 className="mono" style={{ fontFamily: 'inherit', fontSize: 32 }}>{c.case_ref}</h1>
      <ErrorBanner error={error} locale={locale} />
      <div className="grid two">
        <div className="card">
          <dl className="meta">
            <dt>{t('app.status')}</dt><dd><span className="pill">{t(`case.status.${c.status as CaseStatus}`)}</span></dd>
            <dt>{t('app.assigned')}</dt><dd>{c.assigned ?? '—'}</dd>
            <dt>{t('app.channelLabel')}</dt><dd>{t(`app.channel.${c.intake_channel as 'web' | 'whatsapp'}`)} · {LANGUAGE_LABEL[c.locale as Locale]}</dd>
            <dt>{t('app.received')}</dt><dd>{formatDate(c.created_at, locale)}</dd>
            <dt>{t('app.lastActivity')}</dt><dd>{formatDate(c.last_activity_at, locale)}</dd>
            <dt>{t('app.serviceTarget')}</dt><dd>{t('app.serviceTargetValue', { hours: c.response_target_hours })}</dd>
            <dt>{t('app.disputedVersion')}</dt><dd><a className="mono" href={`/p/${c.public_ref}`}>{c.public_ref}</a> · {c.output_title}</dd>
            {c.complainant_accepts !== null && (<><dt>{t('app.complainantView')}</dt><dd>{c.complainant_accepts ? t('app.accepts') : t('app.rejects')}</dd></>)}
          </dl>
        </div>
        <div className="card soft">
          <h3>{t('case.disputed')}</h3>
          <blockquote className="content" lang={lang}>{c.passage}</blockquote>
          <h3 style={{ marginTop: 16 }}>{t('case.concern')}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{c.concern}</p>
          {c.evidence_url && <p className="small">{t('app.evidencePrivate')}: <a href={c.evidence_url} rel="noreferrer noopener" target="_blank">{c.evidence_url}</a></p>}
          {photos.map((ph) => (
            <figure key={ph.id} className="photo-thumb">
              <a href={`/app/complaints/${c.id}/photos/${ph.id}`} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/app/complaints/${c.id}/photos/${ph.id}`} alt={t('app.photo')} loading="lazy" />
              </a>
              <figcaption className="small muted">{t('app.photo')} · {t('app.evidencePrivate')}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <details className="card"><summary>{t('app.registeredContent')}</summary><div className="content small" lang={lang}>{c.version_body}</div></details>

      <h2>{t('app.conversation')}</h2>
      <ol style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m, i) => (
          <li key={i} className="card" style={{ margin: '8px 0', padding: 14, borderStyle: m.visibility === 'internal' ? 'dashed' : 'solid' }}>
            <p className="small muted" style={{ margin: 0 }}>
              {m.display_name ?? t(`case.author.${m.author_kind as 'system'}`)} · {formatDate(m.created_at, locale)} ·{' '}
              {m.visibility === 'internal' ? t('app.internalNote') : t('app.shared')}
            </p>
            <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{renderSystemMessage(m.body, t)}</p>
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
          <div className="actions"><button type="submit" className="secondary">{t('app.assign')}</button></div>
        </form>
        <div className="card">
          <p style={{ marginTop: 0 }}><strong>{t('app.proposeFromComplaint')}</strong></p>
          <div className="actions">
            {claims.map((cl) => (
              <a key={cl.id} className="btn secondary" href={`/app/corrections/new?story=${c.story_id}&claim=${cl.id}&complaint=${c.id}`}>{cl.label}</a>
            ))}
            <a className="btn secondary" href={`/app/corrections/new?story=${c.story_id}&complaint=${c.id}`}>{t('app.editorial')}</a>
          </div>
          {c.correction_id && <p className="small"><a href={`/app/corrections/${c.correction_id}`}>{t('app.linkedCorrection')}</a></p>}
        </div>
      </div>

      {ACTIONS.map((action) => (
        <form key={action} action={deskAction_} className="card">
          <Hidden action={action} />
          <label htmlFor={`m-${action}`}>{t(`app.action.${action}`)}</label>
          <textarea id={`m-${action}`} name="body" required={action !== 'close'} style={{ minHeight: 70 }} />
          <div className="actions"><button type="submit" className={action === 'note' ? 'secondary' : undefined}>{t('app.send')}</button></div>
        </form>
      ))}
    </div>
  );
}
