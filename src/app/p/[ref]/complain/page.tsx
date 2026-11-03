import { notFound } from 'next/navigation';
import { getPassport } from '@/services/passports';
import { getT } from '@/lib/i18n/server';
import { LOCALE_META, type Locale } from '@/lib/i18n';
import { ComplaintForm } from './ComplaintForm';

export const dynamic = 'force-dynamic';

export default async function ComplainPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { t } = await getT();
  const p = await getPassport(ref);
  if (!p) notFound();
  const contentLang = LOCALE_META[p.output.language as Locale]?.htmlLang ?? 'en';
  const step = (n: number) => t('complaint.step', { n, total: 3 });
  return (
    <div className="narrow">
      <p className="eyebrow"><a href={`/p/${p.ref}`}>{t('passport.title')} · <span className="mono">{p.ref}</span></a></p>
      <h1>{t('complaint.title')}</h1>
      <p className="lead">{t('complaint.lead', { publisher: p.publisher.name })}</p>
      <details className="card soft">
        <summary lang={contentLang}>{p.version.title}</summary>
        <div className="content small" lang={contentLang}>{p.version.body}</div>
      </details>
      <ComplaintForm
        versionRef={p.ref}
        contentLang={contentLang}
        labels={{
          step1: step(1), step2: step(2), step3: step(3),
          passage: t('complaint.passage'), passageHelp: t('complaint.passageHelp'), passageNotFound: t('complaint.passageNotFound'),
          concern: t('complaint.concern'), concernHelp: t('complaint.concernHelp'),
          evidence: t('complaint.evidence'), evidenceHelp: t('complaint.evidenceHelp'), optional: t('common.optional'),
          recipient: t('complaint.recipient', { publisher: p.publisher.name }), submit: t('complaint.submit'),
          received: t('complaint.received'), caseRef: t('complaint.caseRef'), trackingLink: t('complaint.trackingLink'),
          trackingHelp: t('complaint.trackingHelp'),
          formError: t('common.error'), rateLimited: t('complaint.rateLimited'), serverError: t('common.error'),
        }}
      />
    </div>
  );
}
