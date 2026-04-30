import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Train, Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 800));
    if (username === 'admin' && password === 'railtwin2024') {
      sessionStorage.setItem('admin_authenticated', 'true');
      navigate('/');
    } else {
      setError('Invalid credentials. Use admin / railtwin2024');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-0.5 bg-primary/10"
            style={{
              left: `${(i / 20) * 100}%`,
              top: 0, bottom: 0,
              opacity: 0.3 + (i % 3) * 0.2,
              animation: `pulse ${2 + (i % 3)}s ease-in-out infinite ${i * 0.2}s`
            }} />
        ))}
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="glass rounded-2xl p-8 border border-border shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center animate-glow">
                <Train className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-accent animate-live-pulse border-2 border-background" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">RailTwin AI</h1>
            <p className="text-sm text-muted-foreground mt-1">Operations Center</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="admin" required />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={password} onChange={e => setPassword(e.target.value)}
                  type={showPwd ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="••••••••••" required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Authenticating...' : 'Access Operations Center'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border text-center">
            <Link to="/passenger-portal" className="text-xs text-muted-foreground hover:text-accent transition-colors">
              → Go to Passenger Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}