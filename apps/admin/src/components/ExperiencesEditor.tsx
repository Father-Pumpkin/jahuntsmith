import { useEffect, useState } from 'react';
import { deleteRow, listExperiences, upsertExperience } from '../api';

const blank = () => ({
  id: '',
  company: '',
  role: '',
  location: '',
  start_date: '',
  end_date: '',
  description: '',
  highlights: [] as string[],
  sort_order: 0,
});

export default function ExperiencesEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await listExperiences());
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const row = {
        ...editing,
        highlights: editing.highlights,
        start_date: editing.start_date || null,
        end_date: editing.end_date || null,
        sort_order: Number(editing.sort_order) || 0,
      };
      if (!row.id) delete row.id;
      await upsertExperience(row);
      setEditing(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this experience?')) return;
    await deleteRow('experiences', id);
    await load();
  }

  if (editing) {
    const set = (k: string) => (e: any) => setEditing({ ...editing, [k]: e.target.value });
    return (
      <div>
        <h2>{editing.id ? 'Edit' : 'New'} experience</h2>
        <div className="row">
          <div><label>Role</label><input value={editing.role} onChange={set('role')} /></div>
          <div><label>Company</label><input value={editing.company} onChange={set('company')} /></div>
        </div>
        <div className="row">
          <div><label>Location</label><input value={editing.location ?? ''} onChange={set('location')} /></div>
          <div><label>Start (YYYY-MM-DD)</label><input value={editing.start_date ?? ''} onChange={set('start_date')} placeholder="2022-01-01" /></div>
          <div><label>End (blank = present)</label><input value={editing.end_date ?? ''} onChange={set('end_date')} placeholder="2024-06-30" /></div>
        </div>
        <label>Description (markdown)</label>
        <textarea value={editing.description ?? ''} onChange={set('description')} />
        <label>Highlights (one per line)</label>
        <textarea
          value={(editing.highlights ?? []).join('\n')}
          onChange={(e) => setEditing({ ...editing, highlights: e.target.value.split('\n').filter(Boolean) })}
        />
        <label>Sort order (lower = higher)</label>
        <input value={editing.sort_order} onChange={set('sort_order')} />
        <div className="actions">
          <button className="btn" onClick={save} disabled={busy || !editing.role || !editing.company}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setEditing(blank())}>+ Add experience</button>
      </div>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 && <p className="muted">No experience yet.</p>}
      {rows.map((r) => (
        <div className="list-item" key={r.id}>
          <div>
            <strong>{r.role}</strong> <span className="muted">· {r.company}</span>
            <div className="meta">{r.start_date ?? '?'} – {r.end_date ?? 'Present'}</div>
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="link" onClick={() => setEditing({ ...r, highlights: Array.isArray(r.highlights) ? r.highlights : [] })}>Edit</button>
            <button className="link danger" onClick={() => remove(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
