import { getCaseForComplainant, type CaseStatus } from '@/services/complaints';
import { currentCaseAccess } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import { formatDate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { acceptAction, replyAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CasePage() {
  const { locale, t } = await getT();
  const access = await currentCaseAccess();
  const c = access ? await getCaseForComplainant(access).catch(() => null) : null;
  if (!c) {
    return (
      <div className="narrow">
        <h1>{t('case.title')}</h1>
        <p className="notice bad" role="alert">{t('case.invalidLink')}</p>
      </div>
    );
  }
  const status = c.status as CaseStatus;
  const decided = status === 'decision_issued' || status === 'closed' || Boolean(c.correction_id);
  return (
    <div className="narrow">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LanguageSwitcher locale={locale} label={t('lang.switch')} next="/case" />
      </div>
      <p className="eyebrow">{t('complaint.caseRef')} · <span className="mono">{c.case_ref}</span></p>
      <h1>{t('case.title')}</h1>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <span className={`status ${status === 'closed' ? 'neutral' : status === 'decision_issued' ? 'current' : 'superseded'}`} role="status">
            {t(`case.status.${status}`)}
          </span>
        </p>
        <dl className="meta">
          <dt>{t('passport.publisher')}</dt><dd>{c.publisher}</dd>
          <dt>{t('passport.output')}</dt><dd><a href={`/p/${c.public_ref}`}>{c.output_title}</a> <span className="mono small">{c.public_ref}</span></dd>
          <dt>{t('case.receivedAt')}</dt><dd>{formatDate(c.created_at, locale)}</dd>
          <dt>{t('case.lastActivity')}</dt><dd>{formatDate(c.last_activity_at, locale)}</dd>
        </dl>
        <p className="small muted">{t('case.serviceTarget', { hours: c.response_target_hours })}</p>
      </div>

      <div className="card soft">
        <h2 style={{ marginTop: 0 }}>{t('case.disputed')}</h2>
        <blockquote className="content">{c.passage}</blockquote>
        <h3>{t('case.concern')}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{c.concern}</p>
        {c.evidence_url && <p className="small mono">{c.evidence_url}</p>}
      </div>

      {(c.decision || c.correction_id) && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('case.decision')}</h2>
          {c.decision && <p style={{ whiteSpace: 'pre-wrap' }}>{c.decision}</p>}
          {c.corrected_refs?.length ? (
            <p className="notice ok">
              {t('case.correctionLinked')}{' '}
              {c.corrected_refs.map((r: string) => <a key={r} className="mono" href={`/p/${r}`} style={{ marginRight: 8 }}>{r}</a>)}
            </p>
          ) : null}
        </div>
      )}

      {decided && (
        <form action={acceptAction} className="card">
          <p style={{ marginTop: 0, fontWeight: 600 }}>{t('case.acceptQuestion')}</p>
          {c.complainant_accepts !== null && (
            <p className="small muted">→ {c.complainant_accepts ? t('case.acceptYes') : t('case.acceptNo')}</p>
          )}
          <div className="actions">
            <button name="accepts" value="yes" type="submit">{t('case.acceptYes')}</button>
            <button name="accepts" value="no" type="submit" className="secondary">{t('case.acceptNo')}</button>
          </div>
        </form>
      )}

      <section aria-labelledby="msgs">
        <h2 id="msgs">{t('case.messages')}</h2>
        {c.messages.length === 0 && <p className="muted">{t('case.noMessages')}</p>}
        <ol style={{ listStyle: 'none', padding: 0 }}>
          {c.messages.map((m: { author_kind: string; body: string; created_at: string }, i: number) => (
            <li key={i} className="card" style={{ margin: '8px 0', padding: 12 }}>
              <p className="small muted" style={{ margin: 0 }}>{m.author_kind} · {formatDate(m.created_at, locale)}</p>
              <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <form action={replyAction} className="card">
        <label htmlFor="body">{t('case.reply')}</label>
        <textarea id="body" name="body" required maxLength={1000} />
        <div className="actions"><button type="submit">{t('case.send')}</button></div>
      </form>

      <p><a href="/case/export">{t('case.export')}</a></p>
    </div>
  );
}
