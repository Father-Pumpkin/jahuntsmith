import { client } from './neon';

export type SessionUser = { id: string; email?: string | null; name?: string | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await client.auth.getSession();
  // better-auth exposes the user at data.user; some versions nest it under session.
  const anyData = data as any;
  return (anyData?.user ?? anyData?.session?.user ?? null) as SessionUser | null;
}

/**
 * Confirms the signed-in user is an admin, self-claiming admin on first login
 * (only succeeds while the `admins` table is empty — the bootstrap RLS policy).
 */
export async function checkOrClaimAdmin(
  user: SessionUser,
): Promise<{ ok: boolean; claimed?: boolean; error?: string }> {
  const existing = await client.from('admins').select('user_id');
  if (existing.error) return { ok: false, error: existing.error.message };
  if (existing.data && existing.data.length > 0) return { ok: true, claimed: false };

  const ins = await client
    .from('admins')
    .insert({ user_id: user.id, email: user.email ?? null })
    .select();
  if (ins.error) return { ok: false, error: ins.error.message };
  if (ins.data && ins.data.length > 0) return { ok: true, claimed: true };
  return { ok: false, error: 'Not authorized — admin has already been claimed by another account.' };
}

// ── Profile ───────────────────────────────────────────────────
export async function getProfile() {
  const { data, error } = await client.from('profile').select('*').eq('id', 1).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProfile(patch: Record<string, unknown>) {
  const { error } = await client
    .from('profile')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw new Error(error.message);
}

// ── Experiences ───────────────────────────────────────────────
export async function listExperiences() {
  const { data, error } = await client
    .from('experiences')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertExperience(row: Record<string, unknown>) {
  if (row.id) {
    const { error } = await client.from('experiences').update(row).eq('id', row.id as string);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('experiences').insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function deleteRow(table: string, id: string) {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Posts ─────────────────────────────────────────────────────
export async function listPosts() {
  const { data, error } = await client
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertPost(row: Record<string, unknown>) {
  const now = new Date().toISOString();
  if (row.id) {
    const { error } = await client
      .from('posts')
      .update({ ...row, updated_at: now })
      .eq('id', row.id as string);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from('posts').insert({ ...row, updated_at: now });
    if (error) throw new Error(error.message);
  }
}

// ── Uploads ───────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Uploads a file into the `assets` table and returns its public /assets path. */
export async function uploadAsset(file: File, kind: 'resume' | 'image'): Promise<string> {
  const base64 = await fileToBase64(file);
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const { data, error } = await client
    .from('assets')
    .insert({
      kind,
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      data: base64,
      byte_size: file.size,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return `/assets/${data.id}.${ext}`;
}
