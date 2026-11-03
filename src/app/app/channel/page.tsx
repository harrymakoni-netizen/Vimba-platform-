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
    many(tx, `select id, kind, channel, status, attempts, last_error, created_at, sent_at from outbox order by created_at desc limit 30`),
  );
  const configured = Boolean(env.kapsoApiKey() && env.kapsoPhoneNumberId() && env.kapsoWebhookSecret());
  const total = usage.inbound + usage.outbound;
  return (
    <div>
      <h1>{t('app.channel')}</h1>
      <div className="grid three">
        <div className="card"><div className="muted small">Kapso</div><strong>{configured ? 'Configured' : 'Not configured (simulator only)'}</strong></div>
        <div className="card"><div className="muted small">Messages {usage.month}</div><strong>{total} / 2,000</strong><div className="small muted">in {usage.inbound} · out {usage.outbound}</div></div>
        <div className="card"><div className="muted small">Soft cap</div><strong>{usage.softCap}</strong><div className="small muted">{usage.softCapReachedAt ? `reached ${formatDate(usage.softCapReachedAt, locale)}` : 'not reached'}</div></div>
      </div>
      <h2>Outbox</h2>
      <form action={workerAction} className="actions"><button type="submit">Run worker now</button></form>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Kind</th><th>Channel</th><th>Status</th><th>Attempts</th><th>Last error</th><th>Created</th><th /></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.kind}</td><td>{j.channel ?? '—'}</td><td><span className="pill">{j.status}</span></td><td>{j.attempts}</td>
                <td className="mono small">{j.last_error ?? ''}</td><td className="small">{formatDate(j.created_at, locale)}</td>
                <td>{(j.status === 'dead' || j.status === 'failed') && (
                  <form action={workerAction}><button type="submit" name="retry" value={j.id} className="secondary">Retry</button></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
