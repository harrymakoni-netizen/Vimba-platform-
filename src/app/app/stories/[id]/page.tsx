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

  return (
    <div>
      <p className="eyebrow"><a href="/app/stories">{t('app.stories')}</a></p>
      <h1>{story.title}</h1>
      <p className="muted small">{t('app.owner')}: {story.owner} · {formatDate(story.created_at, locale)}</p>
      <ErrorBanner error={error} />

      <h2>{t('app.outputs')}</h2>
      {outputs.map((o) => {
        const lang = LOCALE_META[o.language as Locale]?.htmlLang;
        const dirty = o.version_id && (o.draft_body !== o.released_body || o.title !== o.released_title);
        return (
          <details key={o.id} className="card" open={!o.version_id}>
            <summary>
              <span className="pill lang">{o.language.toUpperCase()}</span> {t(`passport.kind.${o.kind}` as 'passport.kind.article')} · {o.title}{' '}
              {o.public_ref ? (
                <span className="small"> · <a className="mono" href={`/p/${o.public_ref}`}>{o.public_ref}</a> · v{o.seq}/{o.version_count}</span>
              ) : (
                <span className="pill">{t('app.unpublished')}</span>
              )}
              {dirty && <span className="pill" style={{ marginLeft: 6 }}>draft changes</span>}
            </summary>
            <form action={saveDraftAction}>
              <input type="hidden" name="storyId" value={story.id} />
              <input type="hidden" name="outputId" value={o.id} />
              <input type="hidden" name="revision" value={o.draft_revision} />
              <input type="hidden" name="baseVersionId" value={o.version_id ?? ''} />
              <label htmlFor={`t-${o.id}`}>Title</label>
              <input id={`t-${o.id}`} name="title" type="text" defaultValue={o.title} lang={lang} required />
              <label htmlFor={`b-${o.id}`}>Content ({LANGUAGE_LABEL[o.language as Locale]})</label>
              <textarea id={`b-${o.id}`} name="body" defaultValue={o.draft_body} lang={lang} rows={6} />
              {o.version_id && canPublish && (
                <>
                  <label htmlFor={`n-${o.id}`}>Change note for a new version</label>
                  <p className="help">Use the Amend correction flow for factual corrections; this is for editorial updates.</p>
                  <input id={`n-${o.id}`} name="changeNote" type="text" lang={lang} />
                </>
              )}
              <div className="actions">
                <button type="submit" name="intent" value="save" className="secondary">{t('app.saveDraft')}</button>
                {canPublish && <button type="submit" name="intent" value="publish">{t('app.publish')}</button>}
                {o.public_ref && <a className="btn secondary" href={`/p/${o.public_ref}/graphic`}>Printable QR graphic</a>}
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
              <label htmlFor="kind">Type</label>
              <select id="kind" name="kind" defaultValue="article">
                <option value="article">{t('passport.kind.article')}</option>
                <option value="bulletin">{t('passport.kind.bulletin')}</option>
                <option value="graphic">{t('passport.kind.graphic')}</option>
                <option value="partner_copy">{t('passport.kind.partner_copy')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="language">{t('passport.language')}</label>
              <select id="language" name="language" defaultValue="en">
                {LOCALES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
              </select>
            </div>
          </div>
          <label htmlFor="otitle">Title</label>
          <input id="otitle" name="title" type="text" required />
          <label htmlFor="obody">Content</label>
          <textarea id="obody" name="body" />
          <label htmlFor="sourceRef">Origin Vimba reference <span className="muted">(partner copies only)</span></label>
          <input id="sourceRef" name="sourceRef" type="text" placeholder="VMB-…" />
          <p className="help">Shona and Ndebele outputs must be reviewed by a fluent editor before release, especially names, dates and figures.</p>
          <div className="actions"><button type="submit">{t('app.addOutput')}</button></div>
        </form>
      </details>

      <h2>{t('app.sources')}</h2>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Label</th><th>Description</th><th>Rev.</th><th>Access</th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}><td>{s.label}</td><td>{s.description}<br /><span className="mono small muted">{s.evidence_pointer}</span></td><td>{s.revision}</td><td className="small">{s.access_rule}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">Source records are private to this newsroom and never appear on a passport.</p>
        <details>
          <summary>{t('app.addSource')}</summary>
          <form action={addSourceAction}>
            <input type="hidden" name="storyId" value={story.id} />
            <div className="grid three">
              <div><label htmlFor="slabel">Label</label><input id="slabel" name="label" type="text" placeholder="S-03" required /></div>
              <div style={{ gridColumn: 'span 2' }}><label htmlFor="sdesc">Description</label><input id="sdesc" name="description" type="text" required /></div>
            </div>
            <label htmlFor="sptr">Private evidence pointer</label>
            <input id="sptr" name="pointer" type="text" placeholder="private://…" />
            <div className="actions"><button type="submit">{t('app.addSource')}</button></div>
          </form>
        </details>
      </div>

      <h2>{t('app.claims')}</h2>
      {claims.map((c) => (
        <div key={c.id} className="card">
          <h3 style={{ marginTop: 0 }}>{c.label}: {c.text}</h3>
          <ul className="small">
            {links.filter((l) => l.claim_id === c.id).map((l) => (
              <li key={l.id}>
                <span className="pill lang">{l.language.toUpperCase()}</span> {t(`passport.kind.${l.kind}` as 'passport.kind.article')}: “{l.passage}”
                {l.source_label && <span className="muted"> · {l.source_label} rev {l.source_revision}</span>} · <em>{l.status}</em>
              </li>
            ))}
          </ul>
          <div className="actions">
            <a className="btn" href={`/app/corrections/new?story=${story.id}&claim=${c.id}`}>{t('app.newCorrection')}</a>
          </div>
          {can(actor, 'claim.link') && (
            <details>
              <summary>{t('app.linkClaim')}</summary>
              <form action={confirmLinkAction}>
                <input type="hidden" name="storyId" value={story.id} />
                <input type="hidden" name="claimId" value={c.id} />
                <div className="grid two">
                  <div>
                    <label htmlFor={`lo-${c.id}`}>Output</label>
                    <select id={`lo-${c.id}`} name="outputId">
                      {outputs.map((o) => <option key={o.id} value={o.id}>{o.language.toUpperCase()} · {o.kind} · {o.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`ls-${c.id}`}>Source</label>
                    <select id={`ls-${c.id}`} name="sourceId">
                      <option value="">—</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <label htmlFor={`lp-${c.id}`}>Exact passage in that output</label>
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
            <div><label htmlFor="clabel">Label</label><input id="clabel" name="label" type="text" placeholder="C-02" required /></div>
            <div style={{ gridColumn: 'span 2' }}><label htmlFor="ctext">Claim</label><input id="ctext" name="text" type="text" required /></div>
          </div>
          <div className="actions"><button type="submit">{t('app.addClaim')}</button></div>
        </form>
      </details>

      {corrections.length > 0 && (
        <>
          <h2>Corrections</h2>
          <ul>
            {corrections.map((c) => (
              <li key={c.id}><a href={`/app/corrections/${c.id}`}>{c.reason.slice(0, 80)}</a> · <span className="pill">{c.status}</span> · {formatDate(c.created_at, locale)}</li>
            ))}
          </ul>
        </>
      )}
      <p><a className="btn secondary" href={`/app/corrections/new?story=${story.id}`}>{t('app.newCorrection')} (editorial)</a></p>
    </div>
  );
}
