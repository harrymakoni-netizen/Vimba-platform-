'use client';

import { useActionState, useRef, useState } from 'react';
import { submitComplaintAction, type ComplaintState } from './actions';

export interface ComplaintLabels {
  step1: string; step2: string; step3: string;
  passage: string; passageHelp: string; passageNotFound: string;
  concern: string; concernHelp: string;
  evidence: string; evidenceHelp: string; optional: string;
  photo: string; photoHelp: string; photoInvalid: string; photoRemove: string;
  voice: string; voiceHelp: string; voiceStart: string; voiceStop: string; voiceRemove: string; voiceRecording: string;
  voiceDenied: string; voiceUnsupported: string; voiceInvalid: string;
  recipient: string; submit: string;
  received: string; caseRef: string; trackingLink: string; trackingHelp: string;
  formError: string; rateLimited: string; serverError: string;
}

const MAX_VOICE_SECONDS = 60;
const MAX_SIDE = 1600;
const MAX_UPLOAD = 4 * 1024 * 1024;

/**
 * Re-encode a chosen photo on the device: at most 1600px on the long side, JPEG.
 * This keeps uploads small on prepaid data and drops embedded metadata such as
 * GPS location. If the browser cannot decode the file, the original is kept.
 */
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function ComplaintForm({ versionRef, labels, contentLang }: { versionRef: string; labels: ComplaintLabels; contentLang: string }) {
  const [state, action, pending] = useActionState<ComplaintState, FormData>(submitComplaintAction, { status: 'idle' });
  const photoInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Voice recording (MediaRecorder). The result is placed in a hidden file input so it posts with the form.
  const voiceInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [rec, setRec] = useState<'idle' | 'recording' | 'done'>('idle');
  const [secs, setSecs] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const voiceSupported = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';

  async function startRecording() {
    setVoiceMsg(null);
    if (!voiceSupported) return setVoiceMsg(labels.voiceUnsupported);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setVoiceMsg(labels.voiceDenied);
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      const mime = mr.mimeType || type || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size) return setRec('idle');
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      try {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], `voice.${ext}`, { type: mime }));
        if (voiceInput.current) voiceInput.current.files = dt.files;
      } catch {
        setRec('idle');
        return setVoiceMsg(labels.voiceUnsupported);
      }
      setVoiceUrl(URL.createObjectURL(blob));
      setRec('done');
    };
    recorder.current = mr;
    mr.start();
    setSecs(0);
    setRec('recording');
    timer.current = setInterval(() => {
      setSecs((n) => {
        if (n + 1 >= MAX_VOICE_SECONDS) mr.state === 'recording' && mr.stop();
        return n + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }

  function removeRecording() {
    if (voiceInput.current) voiceInput.current.value = '';
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceUrl(null);
    setRec('idle');
    setSecs(0);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setPhotoError(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!file) return;
    setBusy(true);
    const small = await shrinkPhoto(file);
    setBusy(false);
    if (small.size > MAX_UPLOAD) {
      input.value = '';
      setPhotoError(true);
      return;
    }
    try {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
    } catch {
      // Older browsers: the original file is sent and checked on the server.
    }
    setPreview(URL.createObjectURL(small));
  }

  function removePhoto() {
    if (photoInput.current) photoInput.current.value = '';
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhotoError(false);
  }

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
        {err === 'voice' && <p className="notice bad" role="alert">{labels.voiceInvalid}</p>}
        {(err === 'photo' || photoError) && <p className="notice bad" role="alert">{labels.photoInvalid}</p>}
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
        <textarea id="concern" name="concern" required={rec !== 'done'} minLength={rec === 'done' ? undefined : 3} maxLength={1000} aria-describedby="concern-help" />
        <div className="voice" role="group" aria-labelledby="voice-label">
          <p id="voice-label" style={{ margin: '14px 0 4px', fontWeight: 600 }}>{labels.voice} <span className="muted">({labels.optional})</span></p>
          <p className="help">{labels.voiceHelp}</p>
          <input ref={voiceInput} type="file" name="voice" hidden tabIndex={-1} aria-hidden="true" />
          {rec === 'idle' && <button type="button" className="secondary" onClick={startRecording}>{labels.voiceStart}</button>}
          {rec === 'recording' && (
            <div className="voice-live" role="status" aria-live="polite">
              <span className="rec-dot" aria-hidden="true" /> {labels.voiceRecording} <span className="mono">0:{String(secs).padStart(2, '0')}</span>
              <button type="button" onClick={stopRecording}>{labels.voiceStop}</button>
            </div>
          )}
          {rec === 'done' && voiceUrl && (
            <div className="voice-done">
              <audio controls src={voiceUrl} />
              <button type="button" className="secondary" onClick={removeRecording}>{labels.voiceRemove}</button>
            </div>
          )}
          {voiceMsg && <p className="notice bad small" role="alert">{voiceMsg}</p>}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: '16px 0 0' }}>
        <legend className="eyebrow">{labels.step3}</legend>
        <label htmlFor="evidence">{labels.evidence} <span className="muted">({labels.optional})</span></label>
        <p className="help" id="evidence-help">{labels.evidenceHelp}</p>
        <input id="evidence" name="evidence" type="url" pattern="https://.*" placeholder="https://" aria-describedby="evidence-help" />
        <label htmlFor="photo">{labels.photo} <span className="muted">({labels.optional})</span></label>
        <p className="help" id="photo-help">{labels.photoHelp}</p>
        <input ref={photoInput} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
          aria-describedby="photo-help" onChange={onPhoto} />
        {preview && (
          <div className="photo-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" />
            <button type="button" className="secondary" onClick={removePhoto}>{labels.photoRemove}</button>
          </div>
        )}
      </fieldset>

      <p className="notice small">{labels.recipient}</p>
      <div className="actions">
        <button type="submit" disabled={pending || busy || rec === 'recording'} aria-busy={pending || busy}>{labels.submit}</button>
      </div>
    </form>
  );
}
