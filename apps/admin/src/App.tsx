import { useEffect, useState } from 'react';
import { client } from './neon';
import { checkOrClaimAdmin, getSessionUser, type SessionUser } from './api';
import ProfileEditor from './components/ProfileEditor';
import ContentManager from './components/ContentManager';
import PostsEditor from './components/PostsEditor';
import ResumeUpload from './components/ResumeUpload';

type Status = 'loading' | 'signedout' | 'notadmin' | 'ready';
type Tab = 'profile' | 'content' | 'posts' | 'resume';

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

  if (status === 'signedout') return <LoginView />;

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
        <button className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>Pages &amp; sections</button>
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Blog posts</button>
        <button className={tab === 'resume' ? 'active' : ''} onClick={() => setTab('resume')}>Résumé PDF</button>
      </nav>

      {tab === 'profile' && <ProfileEditor />}
      {tab === 'content' && <ContentManager />}
      {tab === 'posts' && <PostsEditor />}
      {tab === 'resume' && <ResumeUpload />}
    </div>
  );
}

function LoginView() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function google() {
    setBusy(true);
    setErr(null);
    try {
      // Redirects to Google, then back to /admin/. On return, App re-checks the session.
      const res = await client.auth.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin + import.meta.env.BASE_URL,
      });
      if (res?.error) setErr(res.error.message ?? 'Sign-in failed.');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <div className="card">
        <h1>jahuntsmith · admin</h1>
        <p className="note" style={{ marginBottom: '1.25rem' }}>
          Sign in with an authorized Google account.
        </p>
        <button className="btn" style={{ width: '100%' }} onClick={google} disabled={busy}>
          {busy ? 'Redirecting…' : 'Sign in with Google'}
        </button>
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
