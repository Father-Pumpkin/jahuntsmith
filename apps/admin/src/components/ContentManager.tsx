import { useEffect, useState } from 'react';
import { deleteRow, listPages, saveOrder, upsertRow } from '../api';
import SectionsPanel from './SectionsPanel';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

export default function ContentManager() {
  const [pages, setPages] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function load() {
    try {
      setPages(await listPages());
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function drop(i: number) {
    if (dragIdx === null || dragIdx === i) return setDragIdx(null);
    const next = [...pages];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setPages(next);
    setDragIdx(null);
    try {
      await saveOrder('pages', next.map((p) => p.id));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function save() {
    setErr(null);
    try {
      const row = {
        ...editing,
        slug: editing.is_home ? 'home' : editing.slug || slugify(editing.nav_label),
        sort_order: Number(editing.sort_order) || pages.length,
      };
      if (!row.id) delete row.id;
      await upsertRow('pages', row);
      setEditing(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(p: any) {
    if (p.is_home) return;
    if (!confirm(`Delete the "${p.nav_label}" page and all its sections?`)) return;
    try {
      await deleteRow('pages', p.id);
      if (selected?.id === p.id) setSelected(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // ── Managing one page's sections ──
  if (selected) {
    const page = pages.find((p) => p.id === selected.id) ?? selected;
    return (
      <div>
        <button className="link" onClick={() => setSelected(null)}>← All pages</button>
        <h2 style={{ marginTop: '0.5rem' }}>{page.nav_label} <span className="muted">/{page.is_home ? '' : page.slug}</span></h2>
        <SectionsPanel pageId={page.id} />
      </div>
    );
  }

  // ── Editing page meta ──
  if (editing) {
    const set = (k: string, v: any) => setEditing({ ...editing, [k]: v });
    return (
      <div>
        <h2>{editing.id ? 'Edit' : 'New'} page</h2>
        <label>Nav label</label>
        <input
          value={editing.nav_label ?? ''}
          onChange={(e) => setEditing({ ...editing, nav_label: e.target.value, slug: editing.id || editing.is_home ? editing.slug : slugify(e.target.value) })}
        />
        {!editing.is_home && (
          <>
            <label>Slug (URL path)</label>
            <input value={editing.slug ?? ''} onChange={(e) => set('slug', e.target.value)} />
          </>
        )}
        <label>Subtitle (optional)</label>
        <input value={editing.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={editing.visible ?? true} onChange={(e) => set('visible', e.target.checked)} />
          Visible in nav
        </label>
        <div className="actions">
          <button className="btn" onClick={save} disabled={!editing.nav_label}>Save</button>
          <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  // ── Pages list ──
  return (
    <div>
      <p className="note">Drag to reorder the nav. The home page is fixed at <code>/</code>; other pages get their own URL.</p>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setEditing({ nav_label: '', slug: '', subtitle: '', visible: true, is_home: false })}>+ Add page</button>
      </div>
      {err && <p className="err">{err}</p>}
      {pages.map((p, i) => (
        <div
          className="list-item"
          key={p.id}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          style={{ cursor: 'grab', opacity: dragIdx === i ? 0.5 : 1 }}
        >
          <div>
            <span className="muted" style={{ marginRight: '0.5rem' }}>⠿</span>
            <strong>{p.nav_label}</strong>{' '}
            <span className="meta">/{p.is_home ? '' : p.slug}{!p.visible && ' · hidden'}</span>
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="btn" style={{ padding: '0.35rem 0.7rem' }} onClick={() => setSelected(p)}>Sections</button>
            <button className="link" onClick={() => setEditing({ ...p })}>Edit</button>
            {!p.is_home && <button className="link danger" onClick={() => remove(p)}>Delete</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
