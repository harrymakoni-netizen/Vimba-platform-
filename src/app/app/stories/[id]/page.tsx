import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/session';
import { storyWorkspace } from '@/services/newsroom';
import { can } from '@/services/actor';
import { AppError } from '@/lib/errors';
import { getT } from '@/lib/i18n/server';
import { formatDate, LANGUAGE_LABEL, LOCALE_META, LOCALES, type Locale } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { addClaimAction, addSourceAction, confirmLinkAction, createOutputAction, saveDraftAction } from '../../actions';

export default async function StoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { id } = await params;
  const { error } = await searchParams;
  const { locale, t } = await getT();
  const ws = await storyWorkspace(actor, id).catch((e) => {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  });
  const { story, outputs, sources, claims, links, corrections } = ws;
  const canPublish = can(actor, 'output.publish');
  const kind = (k: string) => t(`passport.kind.${k}` as 'passport.kind.article');

  return (
    <div>
      <p className="eyebrow"><a href="/app/stories">{t('app.stories')}</a></p>
      <h1>{story.title}</h1>
      <p className="muted small">{t('app.owner')}: {story.owner} · {formatDate(story.created_at, locale)}</p>
      <ErrorBanner error={error} locale={locale} />

      <h2>{t('app.outputs')}</h2>
      {outputs.map((o) => {
        const lang = LOCALE_META[o.language as Locale]?.htmlLang;
        const dirty = o.version_id && (o.draft_body !== o.released_body || o.title !== o.released_title);
        return (
          <details key={o.id} className="card" open={!o.version_id}>
            <summary>
              <span className="pill lang">{LANGUAGE_LABEL[o.language as Locale]}</span> {kind(o.kind)} · {o.title}{' '}
              {o.public_ref ? (
                <span className="small"> · <a className="mono" href={`/p/${o.public_ref}`}>{o.public_ref}</a> · {t('passport.version', { n: o.seq, total: o.version_count })}</span>
              ) : (
                <span className="pill">{t('app.unpublished')}</span>
              )}
              {dirty && <span className="pill" style={{ marginLeft: 6 }}>{t('app.unpublishedChanges')}</span>}
            </summary>
            <form action={saveDraftAction}>
              <input type="hidden" name="storyId" value={story.id} />
              <input type="hidden" name="outputId" value={o.id} />
              <input type="hidden" name="revision" value={o.draft_revision} />
              <input type="hidden" name="baseVersionId" value={o.version_id ?? ''} />
              <label htmlFor={`t-${o.id}`}>{t('app.title')}</label>
              <input id={`t-${o.id}`} name="title" type="text" defaultValue={o.title} lang={lang} required />
              <label htmlFor={`b-${o.id}`}>{t('app.contentIn', { language: LANGUAGE_LABEL[o.language as Locale] })}</label>
              <textarea id={`b-${o.id}`} name="body" defaultValue={o.draft_body} lang={lang} rows={6} />
              {o.version_id && canPublish && (
                <>
                  <label htmlFor={`n-${o.id}`}>{t('app.changeNoteNew')}</label>
                  <p className="help">{t('app.changeNoteHelp')}</p>
                  <input id={`n-${o.id}`} name="changeNote" type="text" lang={lang} />
                </>
              )}
              <div className="actions">
                <button type="submit" name="intent" value="save" className="secondary">{t('app.saveDraft')}</button>
                {canPublish && <button type="submit" name="intent" value="publish">{t('app.publish')}</button>}
                {o.public_ref && <a className="btn secondary" href={`/p/${o.public_ref}/graphic`}>{t('passport.printable')}</a>}
              </div>
            </form>
          </details>
        );
      })}

      <details className="card soft">
        <summary>{t('app.addOutput')}</summary>
        <form action={createOutputAction}>
          <input type="hidden" name="storyId" value={story.id} />
          <div className="grid two">
            <div>
              <label htmlFor="kind">{t('app.type')}</label>
              <select id="kind" name="kind" defaultValue="article">
                <option value="article">{t('passport.kind.article')}</option>
                <option value="bulletin">{t('passport.kind.bulletin')}</option>
                <option value="graphic">{t('passport.kind.graphic')}</option>
                <option value="partner_copy">{t('passport.kind.partner_copy')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="language">{t('passport.language')}</label>
              <select id="language" name="language" defaultValue={locale}>
                {LOCALES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor="otitle">{t('app.title')}</label>
          <input id="otitle" name="title" type="text" required />
          <label htmlFor="obody">{t('app.contentIn', { language: '…' })}</label>
          <textarea id="obody" name="body" />
          <label htmlFor="sourceRef">{t('app.originRef')}</label>
          <input id="sourceRef" name="sourceRef" type="text" placeholder="VMB-…" />
          <p className="help">{t('app.translationHelp')}</p>
          <div className="actions"><button type="submit">{t('app.addOutput')}</button></div>
        </form>
      </details>

      <h2>{t('app.sources')}</h2>
      <div className="card table-wrap">
        <table className="stack">
          <thead><tr><th>{t('app.label')}</th><th>{t('app.description')}</th><th>{t('app.revision')}</th><th>{t('app.access')}</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.label}</strong></td>
                <td data-label={t('app.description')}>{s.description}<br /><span className="mono small muted">{s.evidence_pointer}</span></td>
                <td data-label={t('app.revision')}>{s.revision}</td>
                <td className="small" data-label={t('app.access')}>{t(`app.access.${s.access_rule}` as 'app.access.newsroom_only')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">{t('app.sourcesPrivate')}</p>
        <details>
          <summary>{t('app.addSource')}</summary>
          <form action={addSourceAction}>
            <input type="hidden" name="storyId" value={story.id} />
            <div className="grid three">
              <div><label htmlFor="slabel">{t('app.label')}</label><input id="slabel" name="label" type="text" placeholder="S-03" required /></div>
              <div style={{ gridColumn: 'span 2' }}><label htmlFor="sdesc">{t('app.description')}</label><input id="sdesc" name="description" type="text" required /></div>
            </div>
            <label htmlFor="sptr">{t('app.evidencePointer')}</label>
            <input id="sptr" name="pointer" type="text" placeholder="private://…" />
            <div className="actions"><button type="submit">{t('app.addSource')}</button></div>
          </form>
        </details>
      </div>

      <h2>{t('app.claims')}</h2>
      {claims.map((c) => (
        <div key={c.id} className="card">
          <h3>{c.label}: {c.text}</h3>
          <ul className="small">
            {links.filter((l) => l.claim_id === c.id).map((l) => (
              <li key={l.id}>
                <span className="pill lang">{LANGUAGE_LABEL[l.language as Locale]}</span> {kind(l.kind)}: “{l.passage}”
                {l.source_label && <span className="muted"> · {l.source_label}, {t('app.revision').toLowerCase()} {l.source_revision}</span>}
                {' '}· <em>{t(`app.linkStatus.${l.status}` as 'app.linkStatus.confirmed')}</em>
              </li>
            ))}
          </ul>
          <div className="actions">
            <a className="btn" href={`/app/corrections/new?story=${story.id}&claim=${c.id}`}>{t('app.newCorrection')}</a>
          </div>
          {can(actor, 'claim.link') && (
            <details style={{ marginTop: 12 }}>
              <summary>{t('app.linkClaim')}</summary>
              <form action={confirmLinkAction}>
                <input type="hidden" name="storyId" value={story.id} />
                <input type="hidden" name="claimId" value={c.id} />
                <div className="grid two">
                  <div>
                    <label htmlFor={`lo-${c.id}`}>{t('app.output')}</label>
                    <select id={`lo-${c.id}`} name="outputId">
                      {outputs.map((o) => <option key={o.id} value={o.id}>{LANGUAGE_LABEL[o.language as Locale]} · {kind(o.kind)} · {o.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`ls-${c.id}`}>{t('app.source')}</label>
                    <select id={`ls-${c.id}`} name="sourceId">
                      <option value="">—</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <label htmlFor={`lp-${c.id}`}>{t('app.passageIn')}</label>
                <input id={`lp-${c.id}`} name="passage" type="text" required />
                <div className="actions"><button type="submit">{t('app.linkClaim')}</button></div>
              </form>
            </details>
          )}
        </div>
      ))}
      <details className="card soft">
        <summary>{t('app.addClaim')}</summary>
        <form action={addClaimAction}>
          <input type="hidden" name="storyId" value={story.id} />
          <div className="grid three">
            <div><label htmlFor="clabel">{t('app.label')}</label><input id="clabel" name="label" type="text" placeholder="C-02" required /></div>
            <div style={{ gridColumn: 'span 2' }}><label htmlFor="ctext">{t('app.claims')}</label><input id="ctext" name="text" type="text" required /></div>
          </div>
          <div className="actions"><button type="submit">{t('app.addClaim')}</button></div>
        </form>
      </details>

      {corrections.length > 0 && (
        <>
          <h2>{t('app.corrections')}</h2>
          <ul>
            {corrections.map((c) => (
              <li key={c.id}>
                <a href={`/app/corrections/${c.id}`}>{c.reason.slice(0, 80)}</a> · <span className="pill">{t(`app.corr.${c.status}` as 'app.corr.draft')}</span> · {formatDate(c.created_at, locale)}
              </li>
            ))}
          </ul>
        </>
      )}
      <p><a className="btn secondary" href={`/app/corrections/new?story=${story.id}`}>{t('app.editorialCorrection')}</a></p>
    </div>
  );
}
