import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, Map, AlertTriangle, Star, ArrowRight, Users, Train,
  LogIn, LogOut, X, XCircle, Info, Zap, Bell, BellRing, CheckCircle2 } from 'lucide-react';
import { simulateTrainStates, getNetworkStats, STATIONS } from '@/lib/trainSimulation';
import moment from 'moment';
import { getPassengerNotifications, markNotificationRead, clearPassengerNotifications } from '@/lib/passengerNotifications';

const TABS = [
  { id: 'home',          label: 'Home',          icon: Home },
  { id: 'track',         label: 'Track',         icon: Search },
  { id: 'journey',       label: 'Journey',       icon: Map },
  { id: 'alerts',        label: 'Alerts',        icon: AlertTriangle },
  { id: 'notifications', label: 'Notify',        icon: Bell },
  { id: 'favorites',     label: 'Favorites',     icon: Star },
];

function StatusBadge({ status }) {
  const map = {
    on_time: 'bg-green-500/15 text-green-400 border-green-500/30',
    delayed: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
    arrived: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    departed: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  };
  const labels = { on_time: 'On Time', delayed: 'Delayed', cancelled: 'Cancelled', arrived: 'Arrived', departed: 'Departed' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] || map.on_time}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {labels[status] || status}
    </span>
  );
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Train className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">RailTwin AI</h1>
          <p className="text-sm text-muted-foreground mt-1">Passenger Portal</p>
        </div>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Your name (required)" />
          <input value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Email (optional)" />
          <button onClick={() => name && onLogin({ name, email })} disabled={!name}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" />
            Enter Portal
          </button>
        </div>
        <div className="text-center">
          <Link to="/admin-login" className="text-xs text-muted-foreground hover:text-primary transition-colors">Admin Login →</Link>
        </div>
      </div>
    </div>
  );
}

export default function PassengerPortal() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('railtwin_passenger') || 'null'); } catch { return null; }
  });
  const [tab, setTab] = useState('home');
  const [trains, setTrains] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState(() => getPassengerNotifications());
  const [bannerNotif, setBannerNotif] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('railtwin_favorites') || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [journeyFrom, setJourneyFrom] = useState('');
  const [journeyTo, setJourneyTo] = useState('');

  const login = (userData) => {
    localStorage.setItem('railtwin_passenger', JSON.stringify(userData));
    setUser(userData);
  };
  const logout = () => {
    localStorage.removeItem('railtwin_passenger');
    setUser(null);
  };

  useEffect(() => {
    const init = simulateTrainStates(0);
    setTrains(init);
    const interval = setInterval(() => setTrains(simulateTrainStates(Date.now() % 1000)), 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Listen for new passenger notifications pushed from admin trigger ─────────
  useEffect(() => {
    const refresh = () => {
      const fresh = getPassengerNotifications();
      setNotifications(fresh);
      // Show banner for first unread critical/warning
      const unread = fresh.filter(n => !n.read);
      if (unread.length > 0) setBannerNotif(unread[0]);
    };
    window.addEventListener('railtwin_notifications', refresh);
    // Also poll every 10s in case portal was opened in another tab
    const poll = setInterval(refresh, 10000);
    return () => { window.removeEventListener('railtwin_notifications', refresh); clearInterval(poll); };
  }, []);

  // ── Read alerts from localStorage (written by admin Alerts page) ────────────
  const loadAlerts = () => {
    try {
      const stored = localStorage.getItem('railtwin_alerts');
      if (stored) {
        const parsed = JSON.parse(stored);
        setAlerts(parsed);
        return;
      }
    } catch (e) { /* ignore */ }
    // Fallback: generate from current sim state
    const trains = simulateTrainStates(Date.now() % 1000);
    const delayed = trains.filter(t => t.status === 'delayed');
    const highOcc = trains.filter(t => t.capacity > 0 && (t.occupancy / t.capacity) > 0.85);
    const generated = [];
    if (delayed.length > 0) {
      const t = delayed[0];
      generated.push({ id: 'p-1', severity: 'critical', title: `Cascading Delay — ${t.name}`,
        description: `${t.train_number} running ${t.delay_minutes} min late from ${t.current_station} to ${t.next_station}.`,
        train_number: t.train_number, station: t.current_station,
        ai_suggestion: `Platform priority authorised at ${t.next_station}. Expect revised ETA.` });
    }
    if (delayed.length > 1) {
      const t = delayed[1];
      generated.push({ id: 'p-2', severity: 'critical', title: `Service Disruption — ${t.current_station}`,
        description: `${t.train_number} delayed ${t.delay_minutes} min. Platform conflict risk at ${t.current_station}.`,
        train_number: t.train_number, station: t.current_station,
        ai_suggestion: `Alternative services available. Check Journey Planner for options.` });
    }
    if (highOcc.length > 0) {
      const t = highOcc[0];
      generated.push({ id: 'p-3', severity: 'warning', title: `High Occupancy — ${t.name}`,
        description: `${t.train_number} at ${Math.round((t.occupancy/t.capacity)*100)}% capacity. Boarding may be restricted at ${t.next_station}.`,
        train_number: t.train_number, station: t.next_station,
        ai_suggestion: `Consider next available service. Staff deployed at platform.` });
    }
    generated.push({ id: 'p-4', severity: 'info', title: 'Network Status Update',
      description: `${trains.filter(t=>t.status==='on_time').length} of ${trains.length} services running on time. Live updates every 30 seconds.`,
      ai_suggestion: null });
    setAlerts(generated);
  };

  useEffect(() => {
    loadAlerts();
    // Poll every 30 seconds for fresh alerts from admin
    const interval = setInterval(loadAlerts, 30000);
    // Also reload when window gains focus (admin may have just generated alerts)
    window.addEventListener('focus', loadAlerts);
    return () => { clearInterval(interval); window.removeEventListener('focus', loadAlerts); };
  }, []);

  const toggleFav = (num) => {
    setFavorites(prev => {
      const updated = prev.includes(num) ? prev.filter(f => f !== num) : [...prev, num];
      localStorage.setItem('railtwin_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  if (!user) return <LoginScreen onLogin={login} />;

  const stats = getNetworkStats(trains);
  const searchResults = search ? trains.filter(t =>
    t.train_number.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase())
  ) : [];
  const journeyOptions = trains.filter(t =>
    t.route?.includes(journeyFrom) && t.route?.includes(journeyTo) && journeyFrom && journeyTo && journeyFrom !== journeyTo
  );
  const allAlerts = alerts;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const alertBadgeCount = criticalAlerts.length;
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const dismissBanner = () => {
    if (bannerNotif) {
      const updated = markNotificationRead(bannerNotif.id);
      setNotifications(updated);
    }
    setBannerNotif(null);
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    try { localStorage.setItem('railtwin_passenger_notifications', JSON.stringify(updated)); } catch (_) {}
    setNotifications(updated);
    setBannerNotif(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-live-pulse" />
          <span className="text-sm font-bold text-foreground">RailTwin AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Hi, {user.name}</span>
          {/* Notification bell in top bar */}
          <button onClick={() => setTab('notifications')}
            className="relative p-1.5 hover:bg-secondary rounded-lg transition-colors">
            {unreadNotifCount > 0
              ? <BellRing className="w-4 h-4 text-primary" />
              : <Bell className="w-4 h-4 text-muted-foreground" />}
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
                {unreadNotifCount}
              </span>
            )}
          </button>
          <button onClick={logout} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Live notification banner */}
      {bannerNotif && tab !== 'notifications' && (
        <div className="sticky top-[53px] z-20 mx-4 mt-3">
          <div className="rounded-xl border px-4 py-3 flex items-start gap-3 shadow-lg"
            style={{ background: 'hsl(222,41%,12%)', borderColor: bannerNotif.severity === 'critical' ? 'hsl(0,72%,51%,0.5)' : 'hsl(211,100%,62%,0.4)' }}>
            <BellRing className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: bannerNotif.severity === 'critical' ? 'hsl(0,72%,65%)' : 'hsl(211,100%,72%)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">{bannerNotif.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{bannerNotif.message}</p>
              {bannerNotif.train && <p className="text-xs font-mono mt-1" style={{color:'hsl(211,100%,72%)'}}>{bannerNotif.train}{bannerNotif.station ? ` · ${bannerNotif.station}` : ''}</p>}
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button onClick={() => { setTab('notifications'); dismissBanner(); }}
                className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: 'hsl(211,100%,62%,0.15)', color: 'hsl(211,100%,72%)' }}>
                View
              </button>
              <button onClick={dismissBanner} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-lg mx-auto p-4">

          {/* Home */}
          {tab === 'home' && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 p-5">
                <h2 className="text-xl font-bold text-foreground">Good day, {user.name}! 👋</h2>
                <p className="text-sm text-muted-foreground mt-1">{moment().format('dddd, MMMM D')}</p>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'On-Time', value: `${stats.onTimeRate}%`, color: 'text-accent' },
                    { label: 'Active', value: stats.total, color: 'text-primary' },
                    { label: 'Delayed', value: stats.delayed, color: 'text-yellow-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center rounded-xl bg-black/20 backdrop-blur-sm p-3">
                      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {favorites.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Quick Access</h3>
                  <div className="space-y-2">
                    {trains.filter(t => favorites.includes(t.train_number)).map(t => (
                      <div key={t.train_number} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-foreground">{t.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{t.train_number} · {t.current_station} → {t.next_station}</div>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allAlerts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Service Alerts</h3>
                    {criticalAlerts.length > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">
                        {criticalAlerts.length} critical
                      </span>
                    )}
                  </div>
                  {allAlerts.slice(0, 3).map(a => {
                    const isC = a.severity === 'critical';
                    const isW = a.severity === 'warning';
                    const borderCls = isC ? 'border-red-500/30 bg-red-500/5' : isW ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-blue-500/30 bg-blue-500/5';
                    const iconCls = isC ? 'text-red-400' : isW ? 'text-yellow-400' : 'text-blue-400';
                    const Icon = isC ? XCircle : isW ? AlertTriangle : Info;
                    return (
                      <div key={a.id} className={`rounded-xl border p-3 mb-2 ${borderCls}`}>
                        <div className="flex items-start gap-2">
                          <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconCls}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground">{a.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</div>
                            {a.train_number && (
                              <div className="text-xs text-muted-foreground mt-0.5 font-mono">{a.train_number}{a.station ? ` · ${a.station}` : ''}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {allAlerts.length > 3 && (
                    <button onClick={() => setTab('alerts')} className="text-xs text-primary underline mt-1">
                      View all {allAlerts.length} alerts →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Track */}
          {tab === 'track' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Search train number or name..." />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-muted-foreground" /></button>}
              </div>
              {search && searchResults.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No trains found</p>}
              {searchResults.map(train => {
                const occ = train.capacity > 0 ? Math.round((train.passenger_count / train.capacity) * 100) : 0;
                return (
                  <div key={train.train_number} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-foreground">{train.name}</div>
                        <div className="text-xs font-mono text-primary">{train.train_number}</div>
                      </div>
                      <StatusBadge status={train.status} />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{train.origin}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="font-medium text-foreground">{train.destination}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Speed', value: `${train.speed_kmh}`, unit: 'km/h', color: 'text-foreground' },
                        { label: 'Delay', value: train.delay_minutes > 0 ? `+${train.delay_minutes}m` : '✓', color: train.delay_minutes > 0 ? 'text-yellow-400' : 'text-green-400' },
                        { label: 'Platform', value: `P${train.platform}`, color: 'text-foreground' },
                        { label: 'ETA', value: moment(train.estimated_arrival).format('HH:mm'), color: 'text-foreground' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center bg-secondary rounded-xl p-2">
                          <div className={`text-xs font-bold font-mono ${color}`}>{value}</div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                    {train.type !== 'freight' && train.capacity > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Occupancy</span>
                          <span>{occ}%</span>
                        </div>
                        <div className="w-full h-2 bg-secondary rounded-full">
                          <div className={`h-2 rounded-full ${occ > 85 ? 'bg-red-500' : occ > 60 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${occ}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 pt-1">
                      {train.route?.map((s, i) => {
                        const cur = s === train.current_station;
                        const past = train.route.indexOf(train.current_station) > i;
                        return (
                          <div key={i} className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cur ? 'bg-primary ring-2 ring-primary/30' : past ? 'bg-green-500' : 'bg-secondary border border-border'}`} />
                            <span className={`text-xs flex-1 ${cur ? 'text-primary font-medium' : past ? 'text-muted-foreground' : 'text-foreground'}`}>{s}</span>
                            {cur && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">Now</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!search && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Search for a train to track</p>
                </div>
              )}
            </div>
          )}

          {/* Journey Planner */}
          {tab === 'journey' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Plan Your Journey</h3>
                <select value={journeyFrom} onChange={e => setJourneyFrom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">From...</option>
                  {STATIONS.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
                <select value={journeyTo} onChange={e => setJourneyTo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">To...</option>
                  {STATIONS.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              {journeyFrom && journeyTo && journeyOptions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No direct services found</p>
              )}
              {journeyOptions.map(t => {
                const fromIdx = t.route.indexOf(journeyFrom);
                const toIdx = t.route.indexOf(journeyTo);
                const stops = Math.abs(toIdx - fromIdx);
                const occ = t.capacity > 0 ? Math.round((t.passenger_count / t.capacity) * 100) : 0;
                return (
                  <div key={t.train_number} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-foreground">{t.name}</div>
                        <div className="text-xs font-mono text-primary">{t.train_number} · {t.type.replace('_',' ')}</div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold text-foreground">{journeyFrom}</span>
                      <ArrowRight className="w-4 h-4 text-primary" />
                      <span className="font-bold text-foreground">{journeyTo}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center bg-secondary rounded-xl p-2">
                        <div className="text-sm font-bold font-mono text-foreground">{stops}</div>
                        <div className="text-xs text-muted-foreground">Stops</div>
                      </div>
                      <div className="text-center bg-secondary rounded-xl p-2">
                        <div className="text-sm font-bold font-mono text-foreground">P{t.platform}</div>
                        <div className="text-xs text-muted-foreground">Platform</div>
                      </div>
                      <div className="text-center bg-secondary rounded-xl p-2">
                        <div className={`text-sm font-bold font-mono ${occ > 85 ? 'text-red-400' : occ > 60 ? 'text-yellow-400' : 'text-green-400'}`}>{occ}%</div>
                        <div className="text-xs text-muted-foreground">Occupancy</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!journeyFrom && !journeyTo && (
                <div className="text-center py-12 text-muted-foreground">
                  <Map className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select origin and destination</p>
                </div>
              )}
            </div>
          )}

          {tab === 'alerts' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Service Alerts</h2>
                <button onClick={loadAlerts} className="text-xs text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all">
                  <Zap className="w-3 h-3" fill="currentColor" />
                  Refresh
                </button>
              </div>
              {allAlerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active service alerts</p>
                </div>
              ) : allAlerts.map(a => {
                const isC = a.severity === 'critical';
                const isW = a.severity === 'warning';
                const borderCls = isC ? 'border-red-500/30 bg-red-500/5' : isW ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-blue-500/30 bg-blue-500/5';
                const iconCls = isC ? 'text-red-400' : isW ? 'text-yellow-400' : 'text-blue-400';
                const Icon = isC ? XCircle : isW ? AlertTriangle : Info;
                const labelCls = isC ? 'text-red-400 bg-red-500/10 border-red-500/20' : isW ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-blue-400 bg-blue-500/10 border-blue-500/20';
                return (
                  <div key={a.id} className={`rounded-2xl border p-4 ${borderCls}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconCls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${labelCls}`}>{a.severity}</span>
                          {a.train_number && <span className="text-xs font-mono text-muted-foreground">{a.train_number}</span>}
                          {a.station && <span className="text-xs text-muted-foreground">· {a.station}</span>}
                        </div>
                        <div className="font-semibold text-foreground text-sm">{a.title}</div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.description}</p>
                        {a.ai_suggestion && (
                          <div className="mt-2 rounded-lg bg-black/30 border border-emerald-500/20 px-3 py-2">
                            <p className="text-xs text-emerald-400">💡 {a.ai_suggestion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notifications tab */}
          {tab === 'notifications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground">Passenger Notifications</h2>
                <div className="flex gap-2">
                  {notifications.length > 0 && (
                    <button onClick={markAllRead}
                      className="text-xs text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all">
                      <CheckCircle2 className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={() => { clearPassengerNotifications(); setNotifications([]); }}
                      className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary hover:bg-secondary/80 transition-all">
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">No notifications yet</p>
                  <p className="text-xs mt-1">Notifications appear here when operations team triggers an incident response.</p>
                </div>
              ) : notifications.map(n => {
                const typeColors = {
                  eta:      { bg: 'bg-yellow-500/8',  border: 'border-yellow-500/25', icon: '🕐', label: 'text-yellow-400' },
                  platform: { bg: 'bg-blue-500/8',    border: 'border-blue-500/25',   icon: '🚉', label: 'text-blue-400' },
                  service:  { bg: 'bg-purple-500/8',  border: 'border-purple-500/25', icon: '🔄', label: 'text-purple-400' },
                  boarding: { bg: 'bg-orange-500/8',  border: 'border-orange-500/25', icon: '👥', label: 'text-orange-400' },
                  safety:   { bg: 'bg-red-500/8',     border: 'border-red-500/25',    icon: '⚠️', label: 'text-red-400' },
                  info:     { bg: 'bg-blue-500/5',    border: 'border-blue-500/20',   icon: '🧑‍✈️', label: 'text-blue-400' },
                  general:  { bg: 'bg-secondary',     border: 'border-border',        icon: '📢', label: 'text-foreground' },
                };
                const tc = typeColors[n.type] || typeColors.general;
                return (
                  <div key={n.id} onClick={() => { if (!n.read) { const u = markNotificationRead(n.id); setNotifications(u); } }}
                    className={`rounded-2xl border p-4 transition-all cursor-pointer ${tc.bg} ${tc.border} ${n.read ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">{tc.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold ${tc.label}`}>{n.title}</span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {n.train && <span className="text-xs font-mono text-muted-foreground">{n.train}</span>}
                          {n.station && <span className="text-xs text-muted-foreground">· {n.station}</span>}
                          {n.platform && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Platform {n.platform}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">{moment(n.ts).fromNow()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Favorites */}
          {tab === 'favorites' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Tap ⭐ to add/remove from favorites</p>
              {trains.map(t => (
                <div key={t.train_number} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <button onClick={() => toggleFav(t.train_number)} className="flex-shrink-0 p-1">
                    <Star className={`w-4 h-4 ${favorites.includes(t.train_number) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{t.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{t.train_number} · {t.current_station} → {t.next_station}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card flex z-10">
        {TABS.map(({ id, label, icon: Icon }) => {
          const alertBadge  = id === 'alerts'        && alertBadgeCount > 0;
          const notifBadge  = id === 'notifications' && unreadNotifCount > 0;
          return (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center py-3 transition-all relative ${
                tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <div className="relative">
                <Icon className="w-5 h-5" />
                {(alertBadge || notifBadge) && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center">
                    {alertBadge ? alertBadgeCount : unreadNotifCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">{label}</span>
              {tab === id && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}