import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Map, Train, AlertTriangle, GitBranch, 
  BarChart3, Users, ChevronLeft, ChevronRight, Zap, ExternalLink,
  Radio, Wifi, WifiOff
} from 'lucide-react';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Map, label: 'Live Map', path: '/map' },
  { icon: Train, label: 'Trains', path: '/trains' },
  { icon: AlertTriangle, label: 'Alerts', path: '/alerts' },
  { icon: GitBranch, label: 'Workflows', path: '/workflows' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Users, label: 'Passenger View', path: '/passenger' },
];

// Sync badge config keyed by syncStatus value
const SYNC_BADGE = {
  'mta-live': {
    label: 'MTA Live',
    icon: Radio,
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    pulse: true,
  },
  'live': {
    label: 'API Live',
    icon: Wifi,
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    pulse: false,
  },
  'connecting': {
    label: 'Connecting',
    icon: Wifi,
    dot: 'bg-yellow-400',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    pulse: true,
  },
  'offline': {
    label: 'Simulation',
    icon: WifiOff,
    dot: 'bg-slate-400',
    text: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/30',
    pulse: false,
  },
};

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { syncStatus } = useRealTimeTrains();
  const badge = SYNC_BADGE[syncStatus] ?? SYNC_BADGE['offline'];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={`relative flex flex-col transition-all duration-300 border-r border-border glass ${collapsed ? 'w-16' : 'w-60'}`}
        style={{ background: 'hsla(222,41%,8%,0.95)' }}>
        
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Train className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-live-pulse border-2 border-sidebar" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-foreground leading-none">RailTwin AI</div>
              <div className="text-xs text-muted-foreground mt-0.5">Operations Center</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                  ${active 
                    ? 'bg-primary/15 text-primary border border-primary/20' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
                {!collapsed && <span className="text-sm font-medium">{label}</span>}
                {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 border-t border-border pt-3 space-y-2">
          {/* Live data source badge */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${badge.bg}`}>
            <div className="relative flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${badge.dot}`} />
              {badge.pulse && (
                <div className={`absolute inset-0 w-2 h-2 rounded-full ${badge.dot} animate-ping opacity-60`} />
              )}
            </div>
            {!collapsed && (
              <span className={`text-[10px] font-semibold tracking-wide ${badge.text}`}>
                {badge.label}
              </span>
            )}
          </div>

          <a href="/passenger-portal" target="_blank"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-accent hover:bg-accent/10 transition-all">
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Passenger Portal</span>}
          </a>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}