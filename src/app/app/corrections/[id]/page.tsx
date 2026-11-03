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
      <ErrorBanner error={sp.error} />
      {sp.approved && <p className="notice ok" role="status">Correction approved. Successor versions are signed and public; the original QR codes now show them.</p>}
      <div className="card">
        <dl className="meta">
          <dt>Status</dt><dd><span className="pill">{c.status}</span>{c.approved_at && <> · {c.approved_by_name} · {formatDate(c.approved_at, locale)}</>}</dd>
          <dt>{t('passport.correctionReason')}</dt><dd>{c.reason}</dd>
          {c.claim_label && (<><dt>Claim</dt><dd>{c.claim_label}: {c.claim_text}</dd></>)}
          {c.complaint_id && (<><dt>Complaint</dt><dd><a href={`/app/complaints/${c.complaint_id}`}>Open case</a></dd></>)}
        </dl>
        {sources.length > 0 && (
          <>
            <h3>Source evidence (private)</h3>
            <ul className="small">{sources.map((s, i) => <li key={i}>{s.label} rev {s.revision}: {s.description}</li>)}</ul>
          </>
        )}
      </div>

      {stale && editable && <p className="notice bad" role="alert">An affected output has a newer release than this correction&apos;s base. Approval will be refused; start a new correction from the latest version.</p>}

      {affected.map((a) => {
        const lang = LOCALE_META[a.language as Locale]?.htmlLang;
        return (
          <section key={a.id} className="card">
            <h2 style={{ marginTop: 0 }}>
              <span className="pill lang">{a.language.toUpperCase()}</span> {t(`passport.kind.${a.kind}` as 'passport.kind.article')} · {LANGUAGE_LABEL[a.language as Locale]}
            </h2>
            <p className="small muted">
              {t('app.before')}: <a className="mono" href={`/p/${a.base_ref}`}>{a.base_ref}</a> (v{a.base_seq})
              {a.result_ref && <> → {t('app.after')}: <a className="mono" href={`/p/${a.result_ref}`}>{a.result_ref}</a> (v{a.result_seq})</>}
            </p>
            <div className="grid two small"><strong>{t('app.before')}</strong><strong>{t('app.after')}</strong></div>
            <Diff before={`${a.before_title}\n\n${a.before_body}`} after={`${a.replacement_title}\n\n${a.replacement_body}`} lang={lang} />
            <p><strong>{t('passport.correctionNote')}:</strong> <span lang={lang}>{a.change_note}</span></p>
            {editable && (
              <details>
                <summary>Edit replacement</summary>
                <form action={updateReplacementAction}>
                  <input type="hidden" name="correctionId" value={c.id} />
                  <input type="hidden" name="outputId" value={a.output_id} />
                  <label htmlFor={`t-${a.id}`}>Title</label>
                  <input id={`t-${a.id}`} name="title" type="text" defaultValue={a.replacement_title} lang={lang} />
                  <label htmlFor={`b-${a.id}`}>Content</label>
                  <textarea id={`b-${a.id}`} name="body" defaultValue={a.replacement_body} lang={lang} rows={6} />
                  <label htmlFor={`n-${a.id}`}>Change note</label>
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
          <h3 style={{ marginTop: 0 }}>Partner copies</h3>
          <ul>{relays.map((r) => <li key={r.id}>{r.recipient}: <span className="pill">{r.status}</span>{r.response_note && <> · {r.response_note}</>}</li>)}</ul>
          <p className="small muted">Acknowledged is not completed. A partner completes by approving its own successor version.</p>
        </div>
      )}

      {editable && can(actor, 'correction.approve') && (
        <form action={approveCorrectionAction} className="card">
          <input type="hidden" name="correctionId" value={c.id} />
          <p style={{ marginTop: 0 }}>Approving signs a successor for every output above in one transaction. If any step fails, nothing is published.</p>
          <button type="submit">{t('app.approveCorrection')}</button>
        </form>
      )}
      {editable && !can(actor, 'correction.approve') && <p className="notice">An editor must approve this correction.</p>}
    </div>
  );
}
