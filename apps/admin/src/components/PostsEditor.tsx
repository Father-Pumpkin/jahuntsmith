import { useEffect, useState } from 'react';
import { deleteRow, listPosts, upsertPost } from '../api';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

const blank = () => ({
  id: '',
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  tags: [] as string[],
  status: 'draft',
  published_at: null as string | null,
});

export default function PostsEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await listPosts());
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(publish?: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const status = publish === undefined ? editing.status : publish ? 'published' : 'draft';
      const published_at =
        status === 'published' ? editing.published_at ?? new Date().toISOString() : null;
      const row: any = {
        ...editing,
        slug: editing.slug || slugify(editing.title),
        status,
        published_at,
      };
      if (!row.id) delete row.id;
      await upsertPost(row);
      setEditing(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this post?')) return;
    await deleteRow('posts', id);
    await load();
  }

  if (editing) {
    const set = (k: string) => (e: any) => setEditing({ ...editing, [k]: e.target.value });
    return (
      <div>
        <h2>{editing.id ? 'Edit' : 'New'} post</h2>
        <label>Title</label>
        <input
          value={editing.title}
          onChange={(e) =>
            setEditing({
              ...editing,
              title: e.target.value,
              slug: editing.id ? editing.slug : slugify(e.target.value),
            })
          }
        />
        <label>Slug</label>
        <input value={editing.slug} onChange={set('slug')} />
        <label>Excerpt</label>
        <input value={editing.excerpt ?? ''} onChange={set('excerpt')} />
        <label>Body (markdown)</label>
        <textarea style={{ minHeight: '16rem' }} value={editing.body ?? ''} onChange={set('body')} />
        <label>Tags (comma-separated)</label>
        <input
          value={(editing.tags ?? []).join(', ')}
          onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) })}
        />
        <div className="actions">
          <button className="btn" onClick={() => save()} disabled={busy || !editing.title}>{busy ? 'Saving…' : 'Save'}</button>
          {editing.status === 'published' ? (
            <button className="ghost" onClick={() => save(false)} disabled={busy}>Unpublish</button>
          ) : (
            <button className="ghost" onClick={() => save(true)} disabled={busy || !editing.title}>Save &amp; publish</button>
          )}
          <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setEditing(blank())}>+ New post</button>
      </div>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 && <p className="muted">No posts yet.</p>}
      {rows.map((r) => (
        <div className="list-item" key={r.id}>
          <div>
            <strong>{r.title}</strong> <span className={`badge ${r.status === 'published' ? 'pub' : ''}`}>{r.status}</span>
            <div className="meta">/blog/{r.slug}</div>
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="link" onClick={() => setEditing({ ...r, tags: Array.isArray(r.tags) ? r.tags : [] })}>Edit</button>
            <button className="link danger" onClick={() => remove(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
