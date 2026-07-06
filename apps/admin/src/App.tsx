import { useEffect, useState } from 'react';
import { client } from './neon';
import { checkOrClaimAdmin, getSessionUser, type SessionUser } from './api';
import ProfileEditor from './components/ProfileEditor';
import ExperiencesEditor from './components/ExperiencesEditor';
import PostsEditor from './components/PostsEditor';
import ResumeUpload from './components/ResumeUpload';
import CollectionEditor from './components/CollectionEditor';

type Status = 'loading' | 'signedout' | 'notadmin' | 'ready';
type Tab = 'profile' | 'experience' | 'education' | 'skills' | 'projects' | 'posts' | 'resume';

export default function App() {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const u = await getSessionUser();
    if (!u) {
      setUser(null);
      setStatus('signedout');
      return;
    }
    setUser(u);
    const res = await checkOrClaimAdmin(u);
    if (res.ok) {
      setStatus('ready');
      if (res.claimed) setNotice('You are now the admin for this site.');
    } else {
      setStatus('notadmin');
      setNotice(res.error ?? 'Not authorized.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function signOut() {
    await client.auth.signOut();
    setStatus('signedout');
    setUser(null);
  }

  if (status === 'loading') return <div className="center muted">Loading…</div>;

  if (status === 'signedout') return <LoginView onDone={refresh} />;

  if (status === 'notadmin') {
    return (
      <div className="center">
        <div className="card">
          <h1>No access</h1>
          <p className="note">
            Signed in as {user?.email}, but this account isn’t the site admin.
          </p>
          {notice && <p className="err">{notice}</p>}
          <div className="actions">
            <button className="ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>jahuntsmith · admin</h1>
        <div className="actions">
          <span className="muted" style={{ fontSize: '0.85rem' }}>{user?.email}</span>
          <button className="ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
      {notice && <p className="ok">{notice}</p>}
      <nav className="tabs">
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button>
        <button className={tab === 'experience' ? 'active' : ''} onClick={() => setTab('experience')}>Experience</button>
        <button className={tab === 'education' ? 'active' : ''} onClick={() => setTab('education')}>Education</button>
        <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>Skills</button>
        <button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}>Projects</button>
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Blog posts</button>
        <button className={tab === 'resume' ? 'active' : ''} onClick={() => setTab('resume')}>Résumé PDF</button>
      </nav>

      {tab === 'profile' && <ProfileEditor />}
      {tab === 'experience' && <ExperiencesEditor />}
      {tab === 'education' && (
        <CollectionEditor
          table="education"
          singular="education"
          required={['institution']}
          fields={[
            { key: 'institution', label: 'Institution', type: 'text' },
            { key: 'credential', label: 'Credential', type: 'text', placeholder: 'B.S., Ph.D., …' },
            { key: 'field', label: 'Field of study', type: 'text' },
            { key: 'start_date', label: 'Start (YYYY-MM-DD)', type: 'date', placeholder: '2016-09-01' },
            { key: 'end_date', label: 'End (blank = present)', type: 'date' },
            { key: 'sort_order', label: 'Sort', type: 'number' },
            { key: 'description', label: 'Description', type: 'textarea' },
          ]}
          title={(r) => r.institution}
          meta={(r) => [r.credential, r.field].filter(Boolean).join(', ')}
        />
      )}
      {tab === 'skills' && (
        <CollectionEditor
          table="skills"
          singular="skill"
          required={['name']}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'category', label: 'Category', type: 'text', placeholder: 'optional grouping' },
            { key: 'sort_order', label: 'Sort', type: 'number' },
          ]}
          title={(r) => r.name}
          meta={(r) => r.category ?? ''}
        />
      )}
      {tab === 'projects' && (
        <CollectionEditor
          table="projects"
          singular="project"
          required={['name']}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'url', label: 'URL', type: 'text', placeholder: 'https://…' },
            { key: 'sort_order', label: 'Sort', type: 'number' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'tags', label: 'Tags', type: 'tags' },
          ]}
          title={(r) => r.name}
          meta={(r) => (r.tags ?? []).join(', ')}
        />
      )}
      {tab === 'posts' && <PostsEditor />}
      {tab === 'resume' && <ResumeUpload />}
    </div>
  );
}

function LoginView({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res =
        mode === 'in'
          ? await client.auth.signIn.email({ email, password })
          : await client.auth.signUp.email({ email, password, name: name || email });
      if (res.error) {
        setErr(res.error.message ?? 'Authentication failed.');
      } else {
        onDone();
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <h1>{mode === 'in' ? 'Sign in' : 'Create admin account'}</h1>
        {mode === 'up' && (
          <>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </>
        )}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />
        {err && <p className="err">{err}</p>}
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}
          </button>
          <div className="spacer" />
          <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'Create account' : 'Have an account? Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
