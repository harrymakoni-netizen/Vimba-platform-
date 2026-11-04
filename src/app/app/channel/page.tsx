import { requireActor } from '@/lib/session';
import { asSystem, many } from '@/lib/db';
import { usageSummary } from '@/channels/whatsapp/handler';
import { env } from '@/lib/env';
import { formatDate } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';
import { workerAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ChannelPage() {
  await requireActor();
  const { locale, t } = await getT();
  const usage = await usageSummary();
  // Operational metadata only: no message bodies, phone numbers or tokens.
  const jobs = await asSystem((tx) =>
    many(tx, `select id, kind, channel, status, attempts, last_error, created_at from outbox order by created_at desc limit 30`),
  );
  const configured = Boolean(env.kapsoApiKey() && env.kapsoPhoneNumberId() && env.kapsoWebhookSecret());
  const total = usage.inbound + usage.outbound;
  return (
    <div>
      <h1>{t('app.channel')}</h1>
      <div className="grid three">
        <div className="card"><div className="muted small">{t('app.kapso')}</div><strong>{configured ? t('app.connected') : t('app.notConnected')}</strong></div>
        <div className="card">
          <div className="muted small">{t('app.messagesIn', { month: usage.month })}</div>
          <strong>{total} / 2,000</strong>
          <div className="small muted">{t('app.inOut', { in: usage.inbound, out: usage.outbound })}</div>
        </div>
        <div className="card">
          <div className="muted small">{t('app.softCap')}</div>
          <strong>{usage.softCap}</strong>
          <div className="small muted">{usage.softCapReachedAt ? t('app.reachedOn', { date: formatDate(usage.softCapReachedAt, locale) }) : t('app.notReached')}</div>
        </div>
      </div>
      <h2>{t('app.outbox')}</h2>
      <form action={workerAction} className="actions"><button type="submit">{t('app.runWorker')}</button></form>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>{t('app.kind')}</th><th>{t('app.channelLabel')}</th><th>{t('app.status')}</th><th>{t('app.attempts')}</th><th>{t('app.lastError')}</th><th>{t('app.created')}</th><th /></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="mono small">{j.kind}</td>
                <td>{j.channel ?? '—'}</td>
                <td><span className="pill">{t(`app.job.${j.status}` as 'app.job.pending')}</span></td>
                <td>{j.attempts}</td>
                <td className="mono small">{j.last_error ?? ''}</td>
                <td className="small">{formatDate(j.created_at, locale)}</td>
                <td>{(j.status === 'dead' || j.status === 'failed') && (
                  <form action={workerAction}><button type="submit" name="retry" value={j.id} className="secondary">{t('app.retry')}</button></form>
                )}</td>
              </tr>
            ))}
            {!jobs.length && <tr><td colSpan={7} className="muted">{t('app.none')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
