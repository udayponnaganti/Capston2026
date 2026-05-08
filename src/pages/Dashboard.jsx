import { useState, useEffect, useRef } from 'react';
import { Train, Clock, AlertTriangle, Activity, XCircle, Info } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import KpiCard from '@/components/admin/KpiCard';
import TrainStatusCard from '@/components/admin/TrainStatusCard';
import WeatherWidget from '@/components/admin/WeatherWidget';
import { base44 } from '@/api/base44Client';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';
import { useRailTwinStore } from '@/lib/railTwinStore';
import moment from 'moment';

const CHART_HISTORY = 20;

function computeStats(trains) {
  if (!trains.length) return { total: 0, onTime: 0, delayed: 0, cancelled: 0, onTimeRate: 0, avgDelay: 0, totalPassengers: 0, platformUtil: 0 };
  const onTime    = trains.filter(t => ['on_time','arrived','departed'].includes(t.status)).length;
  const delayed   = trains.filter(t => t.status === 'delayed').length;
  const delays    = trains.filter(t => t.delay_minutes > 0).map(t => t.delay_minutes);
  const avgDelay  = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
  const totalPax  = trains.reduce((s, t) => s + (t.passenger_count || t.occupancy || 0), 0);
  const avgOcc    = trains.reduce((s, t) => {
    const cap = t.capacity || 800;
    const pax = t.passenger_count || t.occupancy || 0;
    return s + Math.round((pax / cap) * 100);
  }, 0) / Math.max(trains.length, 1);
  return {
    total: trains.length, onTime, delayed,
    onTimeRate: Math.round((onTime / trains.length) * 100),
    avgDelay, totalPassengers: totalPax,
    platformUtil: Math.round(avgOcc),
  };
}

export default function Dashboard() {
  const { trains, syncStatus } = useRealTimeTrains();
  const aiStore = useRailTwinStore();
  const [alerts, setAlerts]   = useState([]);
  const [delayHistory, setDelayHistory] = useState([]);
  const [throughputHistory, setThroughputHistory] = useState([]);

  // Auto-generate alerts from real delayed trains
  useEffect(() => {
    if (!trains.length) return;
    const loadAlerts = async () => {
      try {
        const apiAlerts = await base44.entities.Alert.list('-created_date', 5);
        if (apiAlerts?.length > 0) { setAlerts(apiAlerts); return; }
      } catch (e) { /* fall through */ }
      const generated = [];
      trains.filter(t => t.delay_minutes >= 6).slice(0, 3).forEach(t => {
        generated.push({
          id: t.train_number + '_delay',
          title: `Cascading Delay — ${t.name}`,
          severity: t.delay_minutes >= 10 ? 'critical' : 'warning',
          train_number: t.train_number,
          station: t.current_station,
        });
      });
      trains.filter(t => t.status === 'cancelled').slice(0, 1).forEach(t => {
        generated.push({ id: t.train_number + '_cancel', title: `Cancelled — ${t.name}`, severity: 'critical', train_number: t.train_number, station: t.current_station });
      });
      setAlerts(generated.slice(0, 5));
    };
    loadAlerts();
    window.addEventListener('focus', loadAlerts);
    return () => window.removeEventListener('focus', loadAlerts);
  }, [trains]);

  // Build chart history from live data every 3s
  useEffect(() => {
    if (!trains.length) return;
    const interval = setInterval(() => {
      const stats = computeStats(trains);
      const timeLabel = moment().format('HH:mm:ss');
      setDelayHistory(prev => [...prev.slice(-CHART_HISTORY), { time: timeLabel, value: stats.avgDelay }]);
      setThroughputHistory(prev => [...prev.slice(-CHART_HISTORY), { time: timeLabel, value: stats.totalPassengers }]);
    }, 3000);
    return () => clearInterval(interval);
  }, [trains]);

  const stats = computeStats(trains);
  const displayTrains = [...trains]
    .sort((a, b) => (b.delay_minutes || 0) - (a.delay_minutes || 0))
    .slice(0, 20);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-live-pulse" />
            <span className="text-xs text-muted-foreground font-mono">
              {syncStatus === 'live' ? 'LIVE · GTFS-RT' : 'LOCAL SIM'} · Updates every 3s · {moment().format('HH:mm:ss')}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Active Trains" value={stats.total} icon={Train} color="blue"
          subtitle={`${stats.onTime} on time`} trend={1} trendLabel="All systems nominal" />
        <KpiCard title="On-Time Rate" value={stats.onTimeRate} unit="%" icon={Activity} color="teal"
          trend={stats.onTimeRate > 80 ? 1 : -1} trendLabel={stats.onTimeRate > 80 ? 'Above target' : 'Below target'} />
        <KpiCard title="Avg Delay" value={stats.avgDelay} unit="min" icon={Clock} color="amber"
          trend={stats.avgDelay < 5 ? 1 : -1} trendLabel={stats.avgDelay < 5 ? 'Acceptable' : 'High delay'} />
        <KpiCard title="Platform Util." value={stats.platformUtil} unit="%" icon={AlertTriangle} color="red"
          subtitle="Across all stations" />
      </div>

      {/* Charts + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delay Trend</span>
            <span className="text-xs font-mono text-warning">{stats.avgDelay} min avg</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={delayHistory}>
              <defs>
                <linearGradient id="delayGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="hsl(38,92%,50%)" fill="url(#delayGrad)" strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: 'hsl(222,41%,10%)', border: '1px solid hsl(222,30%,18%)', borderRadius: 8 }} labelStyle={{ color: 'hsl(215,20%,55%)', fontSize: 10 }} itemStyle={{ color: 'hsl(38,92%,50%)', fontSize: 10 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Network Throughput</span>
            <span className="text-xs font-mono text-primary">{stats.totalPassengers.toLocaleString()} pax</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={throughputHistory}>
              <defs>
                <linearGradient id="throughGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(211,100%,62%)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(211,100%,62%)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="hsl(211,100%,62%)" fill="url(#throughGrad)" strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: 'hsl(222,41%,10%)', border: '1px solid hsl(222,30%,18%)', borderRadius: 8 }} labelStyle={{ color: 'hsl(215,20%,55%)', fontSize: 10 }} itemStyle={{ color: 'hsl(211,100%,62%)', fontSize: 10 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <WeatherWidget />
      </div>

      {/* Active Trains + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Active Trains</h2>
            <span className="text-xs text-muted-foreground font-mono">{displayTrains.length} total</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {displayTrains.map(train => (
              <TrainStatusCard key={train.train_number} train={train} compact />
            ))}
            {displayTrains.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">
                {syncStatus === 'connecting' ? 'Connecting to live feed...' : 'No active trains'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Network Stats</h2>
            <div className="space-y-2">
              {[
                { label: 'Total Passengers', value: stats.totalPassengers.toLocaleString(), color: 'text-primary' },
                { label: 'Delayed Trains',   value: stats.delayed,                          color: 'text-warning' },
                { label: 'Avg Delay',        value: `${stats.avgDelay} min`,               color: 'text-warning' },
                { label: 'On-Time Rate',     value: `${stats.onTimeRate}%`,                color: 'text-accent' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
            <h2 className="text-xs font-medium text-primary uppercase tracking-wide mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" /> NY AI Optimizer
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">AI Score</span>
                <span className={`text-xs font-mono font-bold ${aiStore.optimizationScore > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{aiStore.optimizationScore}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Conflicts Active</span>
                <span className="text-xs font-mono font-bold text-amber-500">{aiStore.conflicts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">NY Throughput</span>
                <span className="text-xs font-mono font-bold text-blue-400">{aiStore.throughput}%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Alerts</h2>
              {alerts.length > 0 && <span className="text-xs text-muted-foreground">{alerts.length} active</span>}
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No alerts — visit the Alerts page to generate.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => {
                  const isC = alert.severity === 'critical';
                  const isW = alert.severity === 'warning';
                  const Icon = isC ? XCircle : isW ? AlertTriangle : Info;
                  const color = isC
                    ? 'text-destructive border-destructive/20 bg-destructive/5'
                    : isW
                    ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
                    : 'text-blue-400 border-blue-500/20 bg-blue-500/5';
                  const iconColor = isC ? 'text-destructive' : isW ? 'text-yellow-400' : 'text-blue-400';
                  return (
                    <div key={alert.id} className={`rounded-lg border px-3 py-2 ${color}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
                          {alert.train_number && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {alert.train_number}{alert.station ? ` · ${alert.station}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}