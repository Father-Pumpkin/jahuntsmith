import { useEffect, useState } from 'react';
import { getProfile, saveProfile, uploadAsset } from '../api';

export default function ResumeUpload() {
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((p) => setCurrent(p.resume_pdf_url)).catch((e) => setErr(e.message));
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type && file.type !== 'application/pdf') {
      setErr('Please choose a PDF file.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const url = await uploadAsset(file, 'resume');
      await saveProfile({ resume_pdf_url: url });
      setCurrent(url);
      setMsg('Résumé uploaded. It appears on the site after the next build.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await saveProfile({ resume_pdf_url: null });
      setCurrent(null);
      setMsg('Removed. The download button disappears after the next build.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Résumé PDF</h2>
      <p className="note">
        Upload a PDF. It’s stored in the database and served from the site as a download.
        The file is written into the site at build time (path: <code>{current ?? '/assets/…'}</code>).
      </p>
      {current ? (
        <p className="ok">Current: <code>{current}</code></p>
      ) : (
        <p className="muted">No résumé uploaded yet.</p>
      )}
      <label>Choose PDF</label>
      <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} />
      <div className="actions">
        {busy && <span className="muted">Uploading…</span>}
        {current && !busy && <button className="ghost danger" onClick={clear}>Remove current</button>}
        {msg && <span className="ok">{msg}</span>}
        {err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}
