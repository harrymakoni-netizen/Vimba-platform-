'use client';

import { useActionState } from 'react';
import { submitComplaintAction, type ComplaintState } from './actions';

export interface ComplaintLabels {
  step1: string; step2: string; step3: string;
  passage: string; passageHelp: string; passageNotFound: string;
  concern: string; concernHelp: string;
  evidence: string; evidenceHelp: string; optional: string;
  recipient: string; submit: string;
  received: string; caseRef: string; trackingLink: string; trackingHelp: string;
  formError: string; rateLimited: string; serverError: string;
}

export function ComplaintForm({ versionRef, labels, contentLang }: { versionRef: string; labels: ComplaintLabels; contentLang: string }) {
  const [state, action, pending] = useActionState<ComplaintState, FormData>(submitComplaintAction, { status: 'idle' });

  if (state.status === 'done') {
    return (
      <div className="card" role="status" aria-live="polite">
        <h2 style={{ marginTop: 0 }}>{labels.received}</h2>
        <dl className="meta">
          <dt>{labels.caseRef}</dt>
          <dd className="mono">{state.caseRef}</dd>
        </dl>
        <label htmlFor="tracking">{labels.trackingLink}</label>
        <input id="tracking" type="text" readOnly value={state.trackingUrl} onFocus={(e) => e.currentTarget.select()} />
        <p className="notice warn small">{labels.trackingHelp}</p>
        <div className="actions"><a className="btn" href={state.trackingUrl} rel="noreferrer">{labels.trackingLink}</a></div>
      </div>
    );
  }

  const err = state.status === 'error' ? state.error : null;
  return (
    <form action={action} className="card" noValidate={false}>
      <input type="hidden" name="ref" value={versionRef} />
      <div aria-live="assertive">
        {err === 'form' && <p className="notice bad" role="alert">{labels.formError}</p>}
        {err === 'rate' && <p className="notice bad" role="alert">{labels.rateLimited}</p>}
        {err === 'server' && <p className="notice bad" role="alert">{labels.serverError}</p>}
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow">{labels.step1}</legend>
        <label htmlFor="passage">{labels.passage}</label>
        <p className="help" id="passage-help">{labels.passageHelp}</p>
        <textarea id="passage" name="passage" required minLength={3} maxLength={1000} lang={contentLang}
          aria-describedby="passage-help" aria-invalid={err === 'passage' || undefined} style={{ minHeight: 80 }} />
        {err === 'passage' && <p className="notice bad" role="alert">{labels.passageNotFound}</p>}
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
        <legend className="eyebrow">{labels.step2}</legend>
        <label htmlFor="concern">{labels.concern}</label>
        <p className="help" id="concern-help">{labels.concernHelp}</p>
        <textarea id="concern" name="concern" required minLength={3} maxLength={1000} aria-describedby="concern-help" />
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
        <legend className="eyebrow">{labels.step3}</legend>
        <label htmlFor="evidence">{labels.evidence} <span className="muted">({labels.optional})</span></label>
        <p className="help" id="evidence-help">{labels.evidenceHelp}</p>
        <input id="evidence" name="evidence" type="url" pattern="https://.*" placeholder="https://" aria-describedby="evidence-help" />
      </fieldset>

      <p className="notice small">{labels.recipient}</p>
      <div className="actions">
        <button type="submit" disabled={pending} aria-busy={pending}>{labels.submit}</button>
      </div>
    </form>
  );
}
