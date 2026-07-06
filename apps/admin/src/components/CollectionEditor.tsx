import { useEffect, useState } from 'react';
import { deleteRow, listTable, upsertRow } from '../api';

export type Field = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'tags';
  placeholder?: string;
};

type Props = {
  table: string;
  singular: string;
  fields: Field[];
  required?: string[];
  orderBy?: string;
  title: (row: any) => string;
  meta?: (row: any) => string;
};

export default function CollectionEditor({
  table,
  singular,
  fields,
  required = [],
  orderBy = 'sort_order',
  title,
  meta,
}: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setRows(await listTable(table, orderBy));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [table]);

  function blank() {
    const r: any = {};
    for (const f of fields) r[f.key] = f.type === 'tags' ? [] : f.type === 'number' ? 0 : '';
    return r;
  }

  function coerce(row: any) {
    const out: any = { ...row };
    for (const f of fields) {
      if (f.type === 'date') out[f.key] = row[f.key] || null;
      else if (f.type === 'number') {
        const v = row[f.key];
        out[f.key] = v === '' || v == null ? (f.key === 'sort_order' ? 0 : null) : Number(v);
      }
    }
    if (!out.id) delete out.id;
    return out;
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await upsertRow(table, coerce(editing));
      setEditing(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(`Delete this ${singular}?`)) return;
    try {
      await deleteRow(table, id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const missingRequired = required.some((k) => !editing?.[k]);

  if (editing) {
    const set = (k: string, v: any) => setEditing({ ...editing, [k]: v });
    const inline = fields.filter((f) => f.type !== 'textarea' && f.type !== 'tags');
    const stacked = fields.filter((f) => f.type === 'textarea' || f.type === 'tags');

    const renderInput = (f: Field) => {
      if (f.type === 'textarea')
        return <textarea value={editing[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />;
      if (f.type === 'tags')
        return (
          <input
            value={(editing[f.key] ?? []).join(', ')}
            placeholder={f.placeholder ?? 'comma, separated'}
            onChange={(e) => set(f.key, e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        );
      return <input value={editing[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
    };

    return (
      <div>
        <h2>{editing.id ? 'Edit' : 'New'} {singular}</h2>
        <div className="row">
          {inline.map((f) => (
            <div key={f.key}>
              <label>{f.label}</label>
              {renderInput(f)}
            </div>
          ))}
        </div>
        {stacked.map((f) => (
          <div key={f.key}>
            <label>{f.label}</label>
            {renderInput(f)}
          </div>
        ))}
        <div className="actions">
          <button className="btn" onClick={save} disabled={busy || missingRequired}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="ghost" onClick={() => setEditing(null)}>Cancel</button>
          {err && <span className="err">{err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        <button className="btn" onClick={() => setEditing(blank())}>+ Add {singular}</button>
      </div>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 && <p className="muted">No {singular} entries yet.</p>}
      {rows.map((r) => (
        <div className="list-item" key={r.id}>
          <div>
            <strong>{title(r)}</strong>
            {meta && <div className="meta">{meta(r)}</div>}
          </div>
          <div className="actions" style={{ margin: 0 }}>
            <button className="link" onClick={() => setEditing({ ...r })}>Edit</button>
            <button className="link danger" onClick={() => remove(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
