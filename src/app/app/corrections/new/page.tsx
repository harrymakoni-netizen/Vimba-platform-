import { requireActor } from '@/lib/session';
import { correctionCandidates } from '@/services/newsroom';
import { getT } from '@/lib/i18n/server';
import { LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { proposeCorrectionAction } from '../../actions';

export default async function NewCorrection({ searchParams }: { searchParams: Promise<{ story: string; claim?: string; complaint?: string; error?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const { t } = await getT();
  const { story, claim, rows } = await correctionCandidates(actor, sp.story, sp.claim);
  return (
    <div>
      <p className="eyebrow"><a href={`/app/stories/${story.id}`}>{story.title}</a></p>
      <h1>{t('app.newCorrection')}</h1>
      {claim && <p className="lead">{claim.label}: {claim.text}</p>}
      <ErrorBanner error={sp.error} />
      <form action={proposeCorrectionAction}>
        <input type="hidden" name="storyId" value={story.id} />
        <input type="hidden" name="claimId" value={claim?.id ?? ''} />
        <input type="hidden" name="complaintId" value={sp.complaint ?? ''} />
        <div className="card">
          <label htmlFor="reason">{t('passport.correctionReason')} (shown publicly)</label>
          <textarea id="reason" name="reason" required style={{ minHeight: 80 }} placeholder="Revised district bulletin: 2 schools closed, not 12." />
        </div>
        <p className="muted small">
          Outputs connected to the claim by confirmed links are pre-selected. Prepare replacement content and a change note in each
          output&apos;s own language. Partner copies are notified after approval; partners publish their own corrections.
        </p>
        {rows.map((r) => {
          const lang = LOCALE_META[r.language as Locale]?.htmlLang;
          const linked = Boolean(r.passages);
          return (
            <fieldset key={r.output_id} className="card" style={{ borderColor: linked ? 'var(--brand)' : undefined }}>
              <legend style={{ padding: '0 6px' }}>
                <label style={{ display: 'inline-flex', gap: 8, margin: 0 }}>
                  <input type="checkbox" name="outputId" value={r.output_id} defaultChecked={linked} />
                  <span className="pill lang">{r.language.toUpperCase()}</span> {t(`passport.kind.${r.kind}` as 'passport.kind.article')} · v{r.seq} ·{' '}
                  <span className="mono small">{r.public_ref}</span>
                </label>
              </legend>
              {r.passages && <p className="small">Confirmed passage: <mark lang={lang}>{r.passages}</mark></p>}
              <label htmlFor={`title:${r.output_id}`}>Replacement title ({LANGUAGE_LABEL[r.language as Locale]})</label>
              <input id={`title:${r.output_id}`} name={`title:${r.output_id}`} type="text" defaultValue={r.title} lang={lang} />
              <label htmlFor={`body:${r.output_id}`}>Replacement content</label>
              <textarea id={`body:${r.output_id}`} name={`body:${r.output_id}`} defaultValue={r.body} lang={lang} rows={6} />
              <label htmlFor={`note:${r.output_id}`}>Change note ({LANGUAGE_LABEL[r.language as Locale]})</label>
              <input id={`note:${r.output_id}`} name={`note:${r.output_id}`} type="text" lang={lang} />
            </fieldset>
          );
        })}
        <div className="actions"><button type="submit">{t('app.reviewCorrection')}</button></div>
      </form>
    </div>
  );
}
