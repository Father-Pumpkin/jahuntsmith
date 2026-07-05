import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '../api';

type Link = { label: string; url: string };

export default function ProfileEditor() {
  const [form, setForm] = useState<any>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) => {
        setForm(p);
        setLinks(Array.isArray(p.links) ? p.links : []);
      })
      .catch((e) => setErr(e.message));
  }, []);

  if (err && !form) return <p className="err">{err}</p>;
  if (!form) return <p className="muted">Loading…</p>;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await saveProfile({
        full_name: form.full_name,
        headline: form.headline,
        summary: form.summary,
        email: form.email,
        phone: form.phone,
        location: form.location,
        links: links.filter((l) => l.label && l.url),
      });
      setMsg('Saved. Rebuild the site (or wait for the scheduled rebuild) to publish.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label>Full name</label>
      <input value={form.full_name ?? ''} onChange={set('full_name')} />
      <label>Headline</label>
      <input value={form.headline ?? ''} onChange={set('headline')} />
      <label>Summary (markdown)</label>
      <textarea value={form.summary ?? ''} onChange={set('summary')} />
      <div className="row">
        <div>
          <label>Email</label>
          <input value={form.email ?? ''} onChange={set('email')} />
        </div>
        <div>
          <label>Phone</label>
          <input value={form.phone ?? ''} onChange={set('phone')} />
        </div>
        <div>
          <label>Location</label>
          <input value={form.location ?? ''} onChange={set('location')} />
        </div>
      </div>

      <label>Links</label>
      {links.map((l, i) => (
        <div className="row" key={i} style={{ marginBottom: '0.4rem' }}>
          <input placeholder="Label (e.g. GitHub)" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input placeholder="https://…" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button className="ghost danger" style={{ flex: '0 0 auto' }} onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button className="ghost" onClick={() => setLinks([...links, { label: '', url: '' }])}>+ Add link</button>

      <div className="actions">
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        {msg && <span className="ok">{msg}</span>}
        {err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}
