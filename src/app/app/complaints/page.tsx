import { requireActor } from '@/lib/session';
import { can } from '@/services/actor';
import { listComplaints, type CaseStatus } from '@/services/complaints';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, type Locale } from '@/lib/i18n';

export default async function ComplaintsPage() {
  const actor = await requireActor();
  const { locale, t } = await getT();
  if (!can(actor, 'complaint.handle')) {
    return (
      <div>
        <h1>{t('app.complaints')}</h1>
        <p className="notice">{t('err.forbidden')}</p>
      </div>
    );
  }
  const rows = await listComplaints(actor);
  return (
    <div>
      <h1>{t('app.complaints')}</h1>
      <p className="muted">{t('app.complaintsLead', { org: actor.orgName })}</p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>{t('app.case')}</th><th>{t('app.status')}</th><th>{t('app.assigned')}</th><th>{t('app.lastActivity')}</th><th>{t('app.nextAction')}</th><th>{t('app.channelLabel')}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const overdue = r.status !== 'closed' && Date.now() - new Date(r.created_at).getTime() > r.response_target_hours * 3600e3;
              return (
                <tr key={r.id}>
                  <td>
                    <a href={`/app/complaints/${r.id}`} className="mono">{r.case_ref}</a>
                    <div className="small muted">{r.output_title} · <span className="mono">{r.public_ref}</span></div>
                    <div className="small">“{r.passage.slice(0, 90)}”</div>
                    {r.group_size > 1 && <span className="pill">{t('app.grouped', { n: r.group_size })}</span>}
                  </td>
                  <td>
                    <span className="pill">{t(`case.status.${r.status as CaseStatus}`)}</span>
                    {overdue && <div className="small" style={{ color: 'var(--bad)' }}>{t('app.pastTarget')}</div>}
                  </td>
                  <td>{r.assigned ?? <span className="muted">—</span>}</td>
                  <td className="small">{formatDate(r.last_activity_at, locale)}<div className="muted">{t('app.received')}: {formatDate(r.created_at, locale)}</div></td>
                  <td className="small">{t(`app.next.${r.status as CaseStatus}`)}</td>
                  <td>
                    <span className="pill">{t(`app.channel.${r.intake_channel as 'web' | 'whatsapp'}`)}</span>{' '}
                    <span className="pill">{LANGUAGE_LABEL[r.locale as Locale]}</span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={6} className="muted">{t('app.noComplaints')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
