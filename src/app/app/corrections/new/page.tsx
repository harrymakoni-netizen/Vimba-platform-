import { requireActor } from '@/lib/session';
import { correctionCandidates } from '@/services/newsroom';
import { getT } from '@/lib/i18n/server';
import { LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { proposeCorrectionAction } from '../../actions';

export default async function NewCorrection({ searchParams }: { searchParams: Promise<{ story: string; claim?: string; complaint?: string; error?: string }> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const { locale, t } = await getT();
  const { story, claim, rows } = await correctionCandidates(actor, sp.story, sp.claim);
  return (
    <div>
      <p className="eyebrow"><a href={`/app/stories/${story.id}`}>{story.title}</a></p>
      <h1>{t('app.newCorrection')}</h1>
      {claim && <p className="lead">{claim.label}: {claim.text}</p>}
      <ErrorBanner error={sp.error} locale={locale} />
      <form action={proposeCorrectionAction}>
        <input type="hidden" name="storyId" value={story.id} />
        <input type="hidden" name="claimId" value={claim?.id ?? ''} />
        <input type="hidden" name="complaintId" value={sp.complaint ?? ''} />
        <div className="card">
          <label htmlFor="reason">{t('app.reasonPublic')}</label>
          <textarea id="reason" name="reason" required style={{ minHeight: 80 }} placeholder={t('app.reasonPlaceholder')} />
        </div>
        <p className="muted small">{t('app.correctionHelp')}</p>
        {rows.map((r) => {
          const lang = LOCALE_META[r.language as Locale]?.htmlLang;
          const langName = LANGUAGE_LABEL[r.language as Locale];
          const linked = Boolean(r.passages);
          return (
            <fieldset key={r.output_id} className="card" style={{ borderColor: linked ? 'var(--brand)' : undefined }}>
              <legend style={{ padding: '0 6px' }}>
                <label style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, margin: 0, alignItems: 'center' }}>
                  <input type="checkbox" name="outputId" value={r.output_id} defaultChecked={linked} />
                  <span className="pill lang">{langName}</span> {t(`passport.kind.${r.kind}` as 'passport.kind.article')} ·{' '}
                  {t('passport.version', { n: r.seq, total: r.seq })} · <span className="mono small">{r.public_ref}</span>
                </label>
              </legend>
              {r.passages && <p className="small">{t('app.confirmedPassage')}: <mark lang={lang}>{r.passages}</mark></p>}
              <label htmlFor={`title:${r.output_id}`}>{t('app.replacementTitle')} ({langName})</label>
              <input id={`title:${r.output_id}`} name={`title:${r.output_id}`} type="text" defaultValue={r.title} lang={lang} />
              <label htmlFor={`body:${r.output_id}`}>{t('app.replacementContent')}</label>
              <textarea id={`body:${r.output_id}`} name={`body:${r.output_id}`} defaultValue={r.body} lang={lang} rows={6} />
              <label htmlFor={`note:${r.output_id}`}>{t('app.changeNote')} ({langName})</label>
              <input id={`note:${r.output_id}`} name={`note:${r.output_id}`} type="text" lang={lang} />
            </fieldset>
          );
        })}
        <div className="actions"><button type="submit">{t('app.reviewCorrection')}</button></div>
      </form>
    </div>
  );
}
