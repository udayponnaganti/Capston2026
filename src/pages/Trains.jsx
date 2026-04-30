import { useState } from 'react';
import { Search, Zap, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';
import TrainStatusCard from '@/components/admin/TrainStatusCard';
import { Button } from '@/components/ui/button';

const STATUS_OPTIONS = ['all', 'on_time', 'delayed', 'cancelled', 'arrived', 'departed'];
const TYPE_OPTIONS = ['all', 'express', 'high_speed', 'local', 'freight'];

// ─── Local AI Analysis Engine ──────────────────────────────────────────────────
function analyzeNetwork(trains) {
  const total = trains.length;
  if (total === 0) return null;

  const delayed    = trains.filter(t => t.status === 'delayed');
  const onTime     = trains.filter(t => t.status === 'on_time');
  const cancelled  = trains.filter(t => t.status === 'cancelled');
  const highSpeed  = trains.filter(t => t.speed_kmh > 180);
  const lowSpeed   = trains.filter(t => t.speed_kmh < 40 && t.status !== 'arrived' && t.status !== 'departed');
  const highOcc    = trains.filter(t => (t.occupancy / t.capacity) > 0.85);

  const avgDelay   = delayed.length > 0
    ? Math.round(delayed.reduce((s, t) => s + t.delay_minutes, 0) / delayed.length)
    : 0;
  const onTimePct  = Math.round((onTime.length / total) * 100);

  // Health score: 100 - penalties
  let healthScore = 100;
  healthScore -= delayed.length * 5;
  healthScore -= cancelled.length * 10;
  healthScore -= highSpeed.length * 3;
  healthScore -= highOcc.length * 2;
  healthScore = Math.max(10, Math.min(100, healthScore));

  // Health summary
  let health = '';
  if (healthScore >= 80) {
    health = `Network is operating well. ${onTimePct}% of trains on time with minimal disruptions across ${total} active services.`;
  } else if (healthScore >= 60) {
    health = `Network is under moderate strain. Only ${onTimePct}% of trains are on time. ${delayed.length} delayed service${delayed.length > 1 ? 's' : ''} require attention — avg delay ${avgDelay} min.`;
  } else {
    health = `Network is under significant strain. Only ${onTimePct}% of trains are on time. Immediate attention recommended for ${delayed.length} delayed and ${cancelled.length} cancelled services.`;
  }

  // Conflicts
  const conflicts = [];
  if (delayed.length > 0) {
    const ids = delayed.map(t => t.train_number).join(', ');
    conflicts.push(`${delayed.length} train(s) delayed: ${ids} — avg delay ${avgDelay} min`);
  }
  if (highSpeed.length > 0) {
    const ids = highSpeed.map(t => t.train_number).join(', ');
    conflicts.push(`${highSpeed.length} train(s) operating at high speed (>180 km/h): ${ids} — monitor for safety thresholds`);
  }
  if (lowSpeed.length > 0) {
    const ids = lowSpeed.map(t => t.train_number).join(', ');
    conflicts.push(`${lowSpeed.length} train(s) running below normal speed (<40 km/h): ${ids}`);
  }
  if (highOcc.length > 0) {
    const ids = highOcc.map(t => `${t.train_number} (${Math.round((t.occupancy / t.capacity) * 100)}%)`).join(', ');
    conflicts.push(`${highOcc.length} train(s) at high occupancy (>85%): ${ids} — overcrowding risk`);
  }
  if (cancelled.length > 0) {
    const ids = cancelled.map(t => t.train_number).join(', ');
    conflicts.push(`${cancelled.length} cancelled service(s): ${ids} — affected passengers need rerouting`);
  }
  if (conflicts.length === 0) {
    conflicts.push('No active conflicts detected — all systems operating within normal parameters.');
  }

  // Delay predictions
  const delay_predictions = [];
  if (delayed.length > 0) {
    const worst = [...delayed].sort((a, b) => b.delay_minutes - a.delay_minutes)[0];
    delay_predictions.push(`${worst.train_number} (${worst.name}) projected to arrive ${worst.delay_minutes + 3}–${worst.delay_minutes + 6} min late at ${worst.next_station} if no intervention`);
  }
  if (highOcc.length > 0) {
    const t = highOcc[0];
    delay_predictions.push(`${t.train_number} high occupancy likely to cause extended dwell time at ${t.next_station}, adding 2–4 min delay`);
  }
  if (delayed.length > 1) {
    delay_predictions.push(`Cascading delays possible at shared hubs if ${delayed.length} delayed trains converge — estimated ${avgDelay + 5} min compounded disruption`);
  }
  if (delay_predictions.length === 0) {
    delay_predictions.push('No significant delay propagation predicted for next 30 minutes.');
  }

  // Optimizations
  const optimizations = [];
  if (delayed.length > 0) {
    optimizations.push('Prioritize platform clearance for delayed trains to reduce cascading delays.');
  }
  if (highSpeed.length > 0) {
    optimizations.push('Review speed compliance for trains exceeding 180 km/h on non-high-speed segments.');
  }
  if (highOcc.length > 0) {
    optimizations.push('Deploy additional staff at high-occupancy boarding points to expedite passenger flow.');
  }
  optimizations.push('Consider optimising dwell times at major stations to improve on-time performance.');
  optimizations.push('Monitor platform utilization at terminus stations to prevent bottlenecks.');

  return { health, health_score: healthScore, conflicts, delay_predictions, optimizations };
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Trains() {
  const { trains, syncStatus } = useRealTimeTrains();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const filtered = trains.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.train_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const generateAnalysis = () => {
    if (analysisOpen && !aiLoading) {
      setAnalysisOpen(false);
      setAiAnalysis(null);
      return;
    }
    setAiLoading(true);
    setAnalysisOpen(true);
    // Simulate a short "thinking" delay for realism
    setTimeout(() => {
      const result = analyzeNetwork(trains);
      setAiAnalysis(result);
      setAiLoading(false);
    }, 1200);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Train Management</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-muted-foreground font-mono">{trains.length} active trains in network</p>
            {/* Backend sync status */}
            <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
              syncStatus === 'live'    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              syncStatus === 'offline' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
                                        'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}>
              {syncStatus === 'live'    ? <Wifi className="w-3 h-3" /> :
               syncStatus === 'offline' ? <WifiOff className="w-3 h-3" /> :
                                          <Loader2 className="w-3 h-3 animate-spin" />}
              {syncStatus === 'live'    ? 'Backend: Live' :
               syncStatus === 'offline' ? 'Backend: Offline (local sim)' :
                                          'Connecting...'}
            </div>
          </div>
        </div>
        <Button onClick={generateAnalysis} disabled={aiLoading} className="bg-blue-500 hover:bg-blue-600 text-white font-medium gap-2">
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" fill="currentColor" />}
          AI Analysis
        </Button>
      </div>


      {/* AI Analysis Panel */}
      {analysisOpen && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" fill="currentColor" />
              <span className="text-base font-semibold text-blue-400">AI Network Analysis</span>
            </div>
            {aiAnalysis && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-1">
                <span>Health Score</span>
                <span className={`font-bold font-mono ${aiAnalysis.health_score >= 80 ? 'text-emerald-400' : aiAnalysis.health_score >= 60 ? 'text-yellow-400' : 'text-destructive'}`}>
                  {aiAnalysis.health_score}/100
                </span>
              </div>
            )}
          </div>

          {aiLoading ? (
            <div className="flex items-center gap-3 text-muted-foreground py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-sm">Analyzing {trains.length} active trains on network...</span>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-4">
              {/* Health Summary */}
              <p className="text-sm text-foreground leading-relaxed">
                {aiAnalysis.health}
              </p>

              {/* Conflicts */}
              {aiAnalysis.conflicts?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-400 mb-2">Conflicts Detected:</h4>
                  <ul className="space-y-1.5 ml-1">
                    {aiAnalysis.conflicts.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Delay Predictions */}
              {aiAnalysis.delay_predictions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-400 mb-2">Delay Predictions:</h4>
                  <ul className="space-y-1.5 ml-1">
                    {aiAnalysis.delay_predictions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-yellow-400 mt-0.5 flex-shrink-0">•</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {aiAnalysis.optimizations?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 mb-2">Suggestions:</h4>
                  <ul className="space-y-1.5 ml-1">
                    {aiAnalysis.optimizations.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0">•</span>
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search trains..." />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary capitalize">
          {STATUS_OPTIONS.map(s => <option key={s} value={s} className="capitalize">{s === 'all' ? 'All Status' : s.replace('_', ' ')}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(train => (
          <TrainStatusCard key={train.train_number} train={train} />
        ))}
      </div>
    </div>
  );
}