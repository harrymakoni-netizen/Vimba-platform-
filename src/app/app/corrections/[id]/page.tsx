import { requireActor } from '@/lib/session';
import { getCorrection } from '@/services/corrections';
import { can } from '@/services/actor';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { Diff } from '@/components/Diff';
import { ErrorBanner } from '@/components/ErrorBanner';
import { approveCorrectionAction, updateReplacementAction } from '../../actions';

export default async function CorrectionReview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; approved?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  const { locale, t } = await getT();
  const { correction: c, affected, sources, relays } = await getCorrection(actor, id);
  const editable = c.status === 'draft' || c.status === 'in_review';
  const stale = affected.some((a) => a.current_version_id !== a.base_version_id && !a.result_version_id);
  return (
    <div>
      <p className="eyebrow"><a href={`/app/stories/${c.story_id}`}>{c.story_title}</a></p>
      <h1>{t('app.reviewCorrection')}</h1>
      <ErrorBanner error={sp.error} locale={locale} />
      {sp.approved && <p className="notice ok" role="status">{t('app.approvedNotice')}</p>}
      <div className="card">
        <dl className="meta">
          <dt>{t('app.status')}</dt>
          <dd><span className="pill">{t(`app.corr.${c.status}` as 'app.corr.draft')}</span>{c.approved_at && <> · {c.approved_by_name} · {formatDate(c.approved_at, locale)}</>}</dd>
          <dt>{t('passport.correctionReason')}</dt><dd>{c.reason}</dd>
          {c.claim_label && (<><dt>{t('app.claims')}</dt><dd>{c.claim_label}: {c.claim_text}</dd></>)}
          {c.complaint_id && (<><dt>{t('app.complaint')}</dt><dd><a href={`/app/complaints/${c.complaint_id}`}>{t('app.openCase')}</a></dd></>)}
        </dl>
        {sources.length > 0 && (
          <>
            <h3>{t('app.sourceEvidence')}</h3>
            <ul className="small">{sources.map((s, i) => <li key={i}>{s.label}: {s.description}</li>)}</ul>
          </>
        )}
      </div>

      {stale && editable && <p className="notice bad" role="alert">{t('app.staleWarning')}</p>}

      {affected.map((a) => {
        const lang = LOCALE_META[a.language as Locale]?.htmlLang;
        return (
          <section key={a.id} className="card">
            <h2 style={{ marginTop: 0, fontSize: 22 }}>
              <span className="pill lang">{LANGUAGE_LABEL[a.language as Locale]}</span> {t(`passport.kind.${a.kind}` as 'passport.kind.article')}
            </h2>
            <p className="small muted">
              {t('app.before')}: <a className="mono" href={`/p/${a.base_ref}`}>{a.base_ref}</a>
              {a.result_ref && <> → {t('app.after')}: <a className="mono" href={`/p/${a.result_ref}`}>{a.result_ref}</a></>}
            </p>
            <div className="grid two small"><strong>{t('app.before')}</strong><strong>{t('app.after')}</strong></div>
            <Diff before={`${a.before_title}\n\n${a.before_body}`} after={`${a.replacement_title}\n\n${a.replacement_body}`} lang={lang} labels={[t('app.before'), t('app.after')]} />
            <p><strong>{t('passport.correctionNote')}:</strong> <span lang={lang}>{a.change_note}</span></p>
            {editable && (
              <details>
                <summary>{t('app.editReplacement')}</summary>
                <form action={updateReplacementAction}>
                  <input type="hidden" name="correctionId" value={c.id} />
                  <input type="hidden" name="outputId" value={a.output_id} />
                  <label htmlFor={`t-${a.id}`}>{t('app.replacementTitle')}</label>
                  <input id={`t-${a.id}`} name="title" type="text" defaultValue={a.replacement_title} lang={lang} />
                  <label htmlFor={`b-${a.id}`}>{t('app.replacementContent')}</label>
                  <textarea id={`b-${a.id}`} name="body" defaultValue={a.replacement_body} lang={lang} rows={6} />
                  <label htmlFor={`n-${a.id}`}>{t('app.changeNote')}</label>
                  <input id={`n-${a.id}`} name="note" type="text" defaultValue={a.change_note} lang={lang} />
                  <div className="actions"><button type="submit" className="secondary">{t('common.save')}</button></div>
                </form>
              </details>
            )}
          </section>
        );
      })}

      {relays.length > 0 && (
        <div className="card soft">
          <h3>{t('app.partnerCopies')}</h3>
          <ul>
            {relays.map((r) => (
              <li key={r.id}>{r.recipient}: <span className="pill">{t(`app.relay.${r.status}` as 'app.relay.pending')}</span>{r.response_note && <> · {r.response_note}</>}</li>
            ))}
          </ul>
          <p className="small muted">{t('app.partnerNote')}</p>
        </div>
      )}

      {editable && can(actor, 'correction.approve') && (
        <form action={approveCorrectionAction} className="card">
          <input type="hidden" name="correctionId" value={c.id} />
          <p style={{ marginTop: 0 }}>{t('app.approveHelp')}</p>
          <button type="submit">{t('app.approveCorrection')}</button>
        </form>
      )}
      {editable && !can(actor, 'correction.approve') && <p className="notice">{t('app.needsEditor')}</p>}
    </div>
  );
}
