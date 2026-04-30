import { useState, useEffect } from 'react';
import { Train, Clock, AlertTriangle, Activity, XCircle, Info } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { simulateTrainStates, getNetworkStats } from '@/lib/trainSimulation';
import KpiCard from '@/components/admin/KpiCard';
import TrainStatusCard from '@/components/admin/TrainStatusCard';
import WeatherWidget from '@/components/admin/WeatherWidget';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import moment from 'moment';

const CHART_HISTORY = 20;

export default function Dashboard() {
  const [tick, setTick] = useState(0);
  const [trains, setTrains] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [delayHistory, setDelayHistory] = useState([]);
  const [throughputHistory, setThroughputHistory] = useState([]);

  // Load alerts: try real API first, fall back to localStorage
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const apiAlerts = await base44.entities.Alert.list('-created_date', 5);
        if (apiAlerts?.length > 0) {
          setAlerts(apiAlerts);
          // Keep localStorage in sync
          localStorage.setItem('railtwin_alerts', JSON.stringify(apiAlerts));
          return;
        }
      } catch (e) { /* API unavailable, fall through */ }
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('railtwin_alerts');
        if (stored) setAlerts(JSON.parse(stored).slice(0, 5));
      } catch (e) { /* ignore */ }
    };
    loadAlerts();
    window.addEventListener('focus', loadAlerts);
    return () => window.removeEventListener('focus', loadAlerts);
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => {
        const newTick = t + 1;
        const newTrains = simulateTrainStates(newTick);
        setTrains(newTrains);
        const stats = getNetworkStats(newTrains);
        const timeLabel = moment().format('HH:mm:ss');
        setDelayHistory(prev => [...prev.slice(-CHART_HISTORY), { time: timeLabel, value: stats.avgDelay }]);
        setThroughputHistory(prev => [...prev.slice(-CHART_HISTORY), { time: timeLabel, value: stats.totalPassengers }]);
        return newTick;
      });
    }, 3000);
    const initialTrains = simulateTrainStates(0);
    setTrains(initialTrains);
    return () => clearInterval(interval);
  }, []);

  const stats = getNetworkStats(trains);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-accent animate-live-pulse" />
            <span className="text-xs text-muted-foreground font-mono">LIVE · Updates every 3s · {moment().format('HH:mm:ss')}</span>
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
        {/* Active trains */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Active Trains</h2>
            <span className="text-xs text-muted-foreground font-mono">{trains.length} total</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {trains.map(train => (
              <TrainStatusCard key={train.train_number} train={train} compact />
            ))}
          </div>
        </div>

        {/* Sidebar: Alerts + Network Stats */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Network Stats</h2>
            <div className="space-y-2">
              {[
                { label: 'Total Passengers', value: stats.totalPassengers.toLocaleString(), color: 'text-primary' },
                { label: 'Delayed Trains', value: stats.delayed, color: 'text-warning' },
                { label: 'Avg Delay', value: `${stats.avgDelay} min`, color: 'text-warning' },
                { label: 'On-Time Rate', value: `${stats.onTimeRate}%`, color: 'text-accent' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Alerts</h2>
              {alerts.length > 0 && (
                <span className="text-xs text-muted-foreground">{alerts.length} active</span>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No alerts yet — visit the Alerts page to generate.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map(alert => {
                  const isC = alert.severity === 'critical';
                  const isW = alert.severity === 'warning';
                  const Icon = isC ? XCircle : isW ? AlertTriangle : Info;
                  const color = isC ? 'text-destructive border-destructive/20 bg-destructive/5'
                    : isW ? 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
                    : 'text-blue-400 border-blue-500/20 bg-blue-500/5';
                  const iconColor = isC ? 'text-destructive' : isW ? 'text-yellow-400' : 'text-blue-400';
                  return (
                    <div key={alert.id} className={`rounded-lg border px-3 py-2 ${color}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{alert.title}</p>
                          {alert.train_number && (
                            <p className="text-xs text-muted-foreground mt-0.5">{alert.train_number}{alert.station ? ` · ${alert.station}` : ''}</p>
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