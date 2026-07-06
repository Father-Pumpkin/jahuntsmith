import { useEffect, useState } from 'react';
import { deleteRow, listSections, saveOrder, upsertRow } from '../api';
import ItemsEditor from './ItemsEditor';

const KINDS = [
  { value: 'timeline', label: 'Timeline — dated entries with bullets' },
  { value: 'cards', label: 'Cards — grid with links/tags' },
  { value: 'list', label: 'List — simple lines' },
  { value: 'tags', label: 'Tags — pill cloud' },
  { value: 'richtext', label: 'Rich text — markdown' },
];

export default function SectionsPanel({ pageId }: { pageId: string }) {
  const [sections, setSections] = useState<any[]>([]);
  const [mode, setMode] = useState<'list' | 'meta' | 'content'>('list');
  const [cur, setCur] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function load() {
    try {
      setSections(await listSections(pageId));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    setMode('list');
    setCur(null);
    void load();
  }, [pageId]);

  async function drop(i: number) {
    if (dragIdx === null || dragIdx === i) return setDragIdx(null);
    const next = [...sections];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setSections(next);
    setDragIdx(null);
    try {
      await saveOrder('sections', next.map((s) => s.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function saveMeta() {
    setErr(null);
    try {
      const row = { ...cur, page_id: pageId, sort_order: Number(cur.sort_order) || sections.length };
      if (!row.id) delete row.id;
      await upsertRow('sections', row);
      setMode('list');
      setCur(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(s: any) {
    if (!confirm('Delete this section and its items?')) return;
    try {
      await deleteRow('sections', s.id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (mode === 'meta' && cur) {
    const set = (k: string, v: any) => setCur({ ...cur, [k]: v });
    return (
      <div style={{ marginTop: '1rem' }}>
        <h3>{cur.id ? 'Edit' : 'New'} section</h3>
        <label>Header (blank = no heading)</label>
        <input value={cur.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        <label>Layout style</label>
        <select value={cur.kind} onChange={(e) => set('kind', e.target.value)}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={cur.visible ?? true} onChange={(e) => set('visible', e.target.checked)} />
          Visible
        </label>
        <div className="actions">
          <button className="btn" onClick={saveMeta}>Save</button>
          <button className="ghost" onClick={() => { setMode('list'); setCur(null); }}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  if (mode === 'content' && cur) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <button className="link" onClick={() => { setMode('list'); setCur(null); void load(); }}>← Sections</button>
        <h3 style={{ marginTop: '0.5rem' }}>{cur.title || '(no header)'} <span className="muted">· {cur.kind}</span></h3>
        {cur.kind === 'richtext' || cur.kind === 'tags' ? (
          <BodyEditor section={cur} />
        ) : (
          <ItemsEditor sectionId={cur.id} kind={cur.kind} />
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <button className="btn" onClick={() => { setCur({ title: '', kind: 'timeline', body: '', visible: true }); setMode('meta'); }}>+ Add section</button>
      </div>
      {err && <p className="err">{err}</p>}
      {sections.length === 0 && <p className="muted">No sections yet. Add one to build this page.</p>}
      {sections.map((s, i) => (
        <div
          className="list-item"
          key={s.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          style={{ cursor: 'grab', opacity: dragIdx === i ? 0.5 : 1 }}
        >
          <div>
            <span className="muted" style={{ marginRight: '0.5rem' }}>⠿</span>
            <strong>{s.title || '(no header)'}</strong> <span className="meta">{s.kind}{!s.visible && ' · hidden'}</span>
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="btn" style={{ padding: '0.35rem 0.7rem' }} onClick={() => { setCur(s); setMode('content'); }}>Content</button>
            <button className="link" onClick={() => { setCur({ ...s }); setMode('meta'); }}>Edit</button>
            <button className="link danger" onClick={() => remove(s)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BodyEditor({ section }: { section: any }) {
  const [body, setBody] = useState(section.body ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await upsertRow('sections', { id: section.id, body });
      setMsg('Saved.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label>{section.kind === 'tags' ? 'Tags (comma or newline separated)' : 'Content (markdown)'}</label>
      <textarea
        style={{ minHeight: section.kind === 'tags' ? '5rem' : '14rem' }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="actions">
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span className="ok">{msg}</span>}
        {err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}
