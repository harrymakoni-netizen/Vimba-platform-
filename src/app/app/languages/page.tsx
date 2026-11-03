import { requireActor } from '@/lib/session';
import { LOCALE_META, LOCALES, packs, type MessageKey } from '@/lib/i18n';
import { env } from '@/lib/env';

export default async function LanguagesPage() {
  await requireActor();
  const all = packs();
  const keys = Object.keys(all.en) as MessageKey[];
  return (
    <div>
      <h1>Language review</h1>
      <p className="lead">
        Vimba ships English, chiShona and isiNdebele. Shona and Ndebele strings are drafts until a fluent reviewer signs them off.
        A translated menu does not establish reliable voice recognition or legal translation.
      </p>
      <div className="grid three">
        {LOCALES.map((l) => (
          <div key={l} className="card">
            <strong>{LOCALE_META[l].name}</strong>
            <div><span className="pill">{LOCALE_META[l].status}</span></div>
            <div className="small muted">{keys.filter((k) => all[l][k]).length} / {keys.length} strings</div>
          </div>
        ))}
      </div>
      <p className="small muted">Draft languages visible to the public: {env.allowDraftLocales() ? 'yes (with notice)' : 'no'}. Set VIMBA_ALLOW_DRAFT_LOCALES=false for a pilot until review is complete.</p>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Key</th>{LOCALES.map((l) => <th key={l}>{LOCALE_META[l].name}</th>)}</tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td className="mono small">{k}</td>
                {LOCALES.map((l) => <td key={l} lang={LOCALE_META[l].htmlLang} className="small" style={{ whiteSpace: 'pre-wrap' }}>{all[l][k]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
