import { useEffect, useState } from 'react';
import { deleteRow, listItems, saveOrder, upsertRow } from '../api';

type Field = { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'tags' | 'bullets' };

const FIELDS: Record<string, Field[]> = {
  timeline: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'subtitle', label: 'Subtitle', type: 'text' },
    { key: 'meta', label: 'Location / detail', type: 'text' },
    { key: 'date_start', label: 'Start (YYYY-MM-DD)', type: 'date' },
    { key: 'date_end', label: 'End (blank = present)', type: 'date' },
    { key: 'body', label: 'Description (markdown)', type: 'textarea' },
    { key: 'bullets', label: 'Highlights (one per line)', type: 'bullets' },
  ],
  cards: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'url', label: 'URL', type: 'text' },
    { key: 'body', label: 'Description', type: 'textarea' },
    { key: 'tags', label: 'Tags', type: 'tags' },
  ],
  list: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'subtitle', label: 'Detail', type: 'text' },
    { key: 'url', label: 'URL', type: 'text' },
  ],
};

export default function ItemsEditor({ sectionId, kind }: { sectionId: string; kind: string }) {
  const fields = FIELDS[kind] ?? FIELDS.list;
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function load() {
    try {
      setRows(await listItems(sectionId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [sectionId]);

  function blank() {
    const r: any = {};
    for (const f of fields) r[f.key] = f.type === 'tags' || f.type === 'bullets' ? [] : '';
    return r;
  }

  function coerce(row: any) {
    const out: any = { ...row, section_id: sectionId };
    for (const f of fields) if (f.type === 'date') out[f.key] = row[f.key] || null;
    if (!out.id) delete out.id;
    return out;
  }

  async function save() {
    setErr(null);
    try {
      await upsertRow('section_items', coerce(editing));
      setEditing(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteRow('section_items', id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function drop(i: number) {
    if (dragIdx === null || dragIdx === i) return setDragIdx(null);
    const next = [...rows];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setRows(next);
    setDragIdx(null);
    try {
      await saveOrder('section_items', next.map((r) => r.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (editing) {
    const set = (k: string, v: any) => setEditing({ ...editing, [k]: v });
    const render = (f: Field) => {
      if (f.type === 'textarea')
        return <textarea value={editing[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
      if (f.type === 'tags')
        return (
          <input
            value={(editing[f.key] ?? []).join(', ')}
            placeholder="comma, separated"
            onChange={(e) => set(f.key, e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        );
      if (f.type === 'bullets')
        return (
          <textarea
            value={(editing[f.key] ?? []).join('\n')}
            onChange={(e) => set(f.key, e.target.value.split('\n').filter((t) => t.trim()))}
          />
        );
      return <input value={editing[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
    };
    const inline = fields.filter((f) => f.type === 'text' || f.type === 'date');
    const stacked = fields.filter((f) => f.type === 'textarea' || f.type === 'tags' || f.type === 'bullets');
    return (
      <div>
        <h4>{editing.id ? 'Edit' : 'New'} item</h4>
        <div className="row">
          {inline.map((f) => (
            <div key={f.key}>
              <label>{f.label}</label>
              {render(f)}
            </div>
          ))}
        </div>
        {stacked.map((f) => (
          <div key={f.key}>
            <label>{f.label}</label>
            {render(f)}
          </div>
        ))}
        <div className="actions">
          <button className="btn" onClick={save} disabled={!editing.title}>Save</button>
          <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="actions" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        <button className="btn" onClick={() => setEditing(blank())}>+ Add item</button>
      </div>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 && <p className="muted">No items yet.</p>}
      {rows.map((r, i) => (
        <div
          className="list-item"
          key={r.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          style={{ cursor: 'grab', opacity: dragIdx === i ? 0.5 : 1 }}
        >
          <div>
            <span className="muted" style={{ marginRight: '0.5rem' }}>⠿</span>
            <strong>{r.title || '(untitled)'}</strong>
            {r.subtitle && <span className="meta"> · {r.subtitle}</span>}
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="link" onClick={() => setEditing({ ...r, tags: Array.isArray(r.tags) ? r.tags : [], bullets: Array.isArray(r.bullets) ? r.bullets : [] })}>Edit</button>
            <button className="link danger" onClick={() => remove(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
