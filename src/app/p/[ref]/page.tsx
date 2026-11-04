import { notFound } from 'next/navigation';
import { getPassport } from '@/services/passports';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { passportUrl, qrSvg, whatsappCheckUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export default async function PassportPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { locale, t } = await getT();
  const p = await getPassport(ref).catch(() => undefined);
  if (p === null) notFound();

  if (!p) {
    return (
      <div className="narrow">
        <p className="eyebrow">{t('passport.title')}</p>
        <p><span className="status unavailable" role="status">{t('passport.status.unavailable')}</span></p>
        <p>{t('passport.status.unavailableHelp')}</p>
      </div>
    );
  }

  const contentLang = LOCALE_META[p.output.language as Locale]?.htmlLang ?? 'en';
  const wa = whatsappCheckUrl(p.ref);
  const qr = await qrSvg(passportUrl(p.ref));
  const waQr = wa ? await qrSvg(wa) : null;

  return (
    <div className="narrow">
      <p className="eyebrow">{t('passport.title')} · <span className="mono">{p.ref}</span></p>

      <section aria-labelledby="status-h" className="card">
        <h2 id="status-h" className="sr-only" style={{ margin: 0, fontSize: 0 }}>{t('passport.title')}</h2>
        <p style={{ margin: 0 }}>
          <span className={`status ${p.status}`} role="status">{t(`passport.status.${p.status}`)}</span>
        </p>
        <p className="muted small">{t(`passport.status.${p.status}Help` as 'passport.status.currentHelp')}</p>
        <dl className="meta">
          <dt>{t('passport.publisher')}</dt>
          <dd>{p.publisher.name}{p.publisher.domain ? <span className="muted"> · {p.publisher.domain}</span> : null}</dd>
          <dt>{t('passport.output')}</dt>
          <dd lang={contentLang}>{p.version.title} <span className="pill">{t(`passport.kind.${p.output.kind}` as 'passport.kind.article')}</span></dd>
          <dt>{t('passport.language')}</dt>
          <dd>{LANGUAGE_LABEL[p.output.language as Locale] ?? p.output.language}</dd>
          <dt>{t('passport.version', { n: p.version.number, total: p.version.total })}</dt>
          <dd>{t('passport.publishedAt')} {formatDate(p.version.publishedAt, locale)}</dd>
          <dt>{t('passport.lastChecked')}</dt>
          <dd>{formatDate(p.checkedAt, locale)}</dd>
        </dl>
        {p.republishedFrom && (
          <p className="small">
            {t('passport.republishedFrom', { publisher: p.republishedFrom.publisher })}
            {p.republishedFrom.ref && <> · <a href={`/p/${p.republishedFrom.ref}`} className="mono">{p.republishedFrom.ref}</a></>}
          </p>
        )}
      </section>

      {p.latest && (
        <section className="card" aria-labelledby="latest-h" style={{ borderColor: 'var(--warn)' }}>
          <h2 id="latest-h" style={{ marginTop: 0 }}>{t('passport.correctionNote')}</h2>
          {p.latest.changeNote && <p lang={contentLang}>{p.latest.changeNote}</p>}
          {p.latest.correctionReason && (
            <p className="small"><strong>{t('passport.correctionReason')}:</strong> {p.latest.correctionReason}</p>
          )}
          <p className="small muted">{t('passport.version', { n: p.latest.number, total: p.version.total })} · {formatDate(p.latest.publishedAt, locale)}</p>
          <div className="actions">
            <a className="btn" href={`/p/${p.latest.ref}`}>{t('passport.openLatest')}</a>
          </div>
        </section>
      )}

      <section aria-labelledby="content-h">
        <h2 id="content-h">{t('passport.historical')}</h2>
        <div className="card content-preview">
          <h3 lang={contentLang}>{p.version.title}</h3>
          <div className="content" lang={contentLang}>{p.version.body}</div>
        </div>
      </section>

      <div className="actions">
        <a className="btn" href={`/p/${p.ref}/complain`}>{t('passport.requestCorrection')}</a>
        {wa && <a className="btn secondary" href={wa} rel="noopener">{t('passport.whatsapp')}</a>}
        <a className="btn secondary" href={`/p/${p.ref}/graphic`}>{t('passport.printable')}</a>
      </div>

      <div className="grid two" style={{ marginTop: 20 }}>
        <div className="card soft">
          <div className="qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="small muted mono">{passportUrl(p.ref)}</p>
        </div>
        {waQr && (
          <div className="card soft">
            <div className="qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: waQr }} />
            <p className="small muted">{t('passport.whatsapp')}: CHECK {p.ref}</p>
          </div>
        )}
      </div>

      <section aria-labelledby="receipt-h" className="card">
        <h2 id="receipt-h" style={{ marginTop: 0 }}>{t('passport.receipt')}</h2>
        <p>
          <span className={`status ${p.verification.signatureValid && p.verification.contentMatches ? 'current' : 'withdrawn'}`}>
            {p.verification.signatureValid && p.verification.contentMatches ? t('passport.receiptValid') : t('passport.receiptInvalid')}
          </span>
        </p>
        <dl className="meta small">
          <dt>{t('passport.issuer')}</dt>
          <dd className="mono">{p.verification.issuerId} · {p.receipt.key_id}</dd>
          <dt>{t('passport.issuerBasis')}</dt>
          <dd>{process.env.VIMBA_ISSUER_BASIS ? p.verification.issuerBasis : t('passport.issuerBasisDemo')}</dd>
        </dl>
        <p className="small muted">{t('passport.boundary')}</p>
        <details>
          <summary>{t('passport.technical')}</summary>
          <pre className="mono small" style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ receipt: p.receipt, signature: p.signature }, null, 2)}</pre>
          <p className="small">
            <a href={`/api/passports/${p.ref}`}>/api/passports/{p.ref}</a> · <a href="/api/keys">/api/keys</a>
          </p>
        </details>
      </section>

      {p.history.length > 1 && (
        <section>
          <h2>{t('passport.history')}</h2>
          <ol className="small">
            {p.history.map((h) => (
              <li key={h.ref}>
                {h.ref === p.ref ? <strong className="mono">{h.ref}</strong> : <a className="mono" href={`/p/${h.ref}`}>{h.ref}</a>}{' '}
                · {t('passport.version', { n: h.number, total: p.version.total })} · {formatDate(h.publishedAt, locale)}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
