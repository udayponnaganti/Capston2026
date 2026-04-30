import { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, Info, Zap, Loader2, RefreshCw, Train,
         MapPin, Clock, Cpu, ChevronRight, CheckCircle2, X, Users, Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { simulateTrainStates } from '@/lib/trainSimulation';
import { base44 } from '@/api/base44Client';

// ─── severity config ───────────────────────────────────────────────────────────
const severityConfig = {
  critical: {
    icon: XCircle,
    bg: 'bg-destructive/10', border: 'border-destructive/30',
    text: 'text-destructive', badge: 'bg-destructive/10 text-destructive border-destructive/30',
    label: 'CRITICAL',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-500/10', border: 'border-yellow-500/30',
    text: 'text-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    label: 'WARNING',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10', border: 'border-blue-500/30',
    text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    label: 'INFO',
  },
};

const TEAMS = ['operations', 'mechanical', 'electrical', 'safety', 'it', 'track'];

const teamColors = {
  operations: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  mechanical:  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  electrical:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  safety:      'bg-red-500/20 text-red-400 border-red-500/30',
  it:          'bg-purple-500/20 text-purple-400 border-purple-500/30',
  track:       'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

// ─── AI task generator ─────────────────────────────────────────────────────────
function generateTasks(alert) {
  const type = alert.type || 'anomaly';
  const sev  = alert.severity || 'warning';

  const taskSets = {
    delay: [
      { title: 'Notify downstream stations of revised ETA', team: 'operations' },
      { title: 'Authorise platform priority at next stop', team: 'operations' },
      { title: 'Assess timetable knock-on effect', team: 'operations' },
      { title: 'Update passenger information boards', team: 'it' },
      sev === 'critical' && { title: 'Escalate to network control centre', team: 'safety' },
    ],
    conflict: [
      { title: 'Hold conflicting service at current station', team: 'operations' },
      { title: 'Reassign platform allocation', team: 'operations' },
      { title: 'Coordinate track switching sequence', team: 'track' },
      { title: 'Deploy platform staff for crowd management', team: 'safety' },
      { title: 'Log platform conflict for incident report', team: 'it' },
    ],
    anomaly: [
      { title: 'Investigate anomaly source', team: 'operations' },
      { title: 'Run system diagnostics', team: 'it' },
      { title: 'Inspect affected segment infrastructure', team: 'track' },
      { title: 'Escalate if root cause found', team: 'safety' },
    ],
    weather: [
      { title: 'Issue weather advisory to all active drivers', team: 'operations' },
      { title: 'Reduce speed limits on exposed segments', team: 'track' },
      { title: 'Check signal equipment for weather damage', team: 'electrical' },
      { title: 'Update passenger travel advisories', team: 'it' },
    ],
    maintenance: [
      { title: 'Dispatch maintenance crew to location', team: 'mechanical' },
      { title: 'Isolate affected track segment', team: 'track' },
      { title: 'Run electrical safety checks', team: 'electrical' },
      { title: 'File maintenance work order', team: 'it' },
      { title: 'Monitor for secondary failures', team: 'safety' },
    ],
  };

  return (taskSets[type] || taskSets.anomaly).filter(Boolean);
}

// ─── Incident Response Panel (slide-over) ──────────────────────────────────────
function IncidentPanel({ alert, onClose }) {
  const [leadTeam, setLeadTeam] = useState('operations');
  const [notes, setNotes]       = useState('');
  const [tasks]                 = useState(() => generateTasks(alert));
  const [triggering, setTriggering] = useState(false);
  const [triggered, setTriggered]   = useState(false);

  const cfg  = severityConfig[alert.severity] || severityConfig.info;
  const Icon = cfg.icon;

  const priority = alert.severity === 'critical' ? 'p1' : alert.severity === 'warning' ? 'p2' : 'p3';

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      // Save incident workflow to backend
      const workflow = {
        alert_title:    alert.title,
        alert_severity: alert.severity,
        alert_type:     alert.type || 'anomaly',
        train_number:   alert.train_number || '',
        station:        alert.station || '',
        status:         'in_progress',
        priority,
        assigned_team:  leadTeam,
        protocol:       tasks.map(t => `[${t.team.toUpperCase()}] ${t.title}`).join('\n'),
        notes,
      };
      await base44.entities.IncidentWorkflow.create(workflow);
    } catch (e) { /* backend unavailable, still proceed */ }
    setTriggering(false);
    setTriggered(true);
    setTimeout(onClose, 1800);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Side panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col bg-card border-l border-border shadow-2xl overflow-y-auto">

        {/* Top strip */}
        <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Incident Response</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-all">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-foreground mb-2">{alert.title}</h2>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-bold ${cfg.badge}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
            <span className="inline-flex text-xs px-2 py-0.5 rounded-full border bg-secondary border-border text-muted-foreground capitalize">
              {alert.type || 'anomaly'}
            </span>
            {alert.train_number && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-secondary border-border text-muted-foreground font-mono">
                <Train className="w-3 h-3" /> {alert.train_number}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold uppercase">
              {priority}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto">

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">{alert.description}</p>

          {/* AI Suggestion */}
          {alert.ai_suggestion && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-4 py-3 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" />
              <div>
                <p className="text-xs font-semibold text-emerald-400 mb-0.5">AI Recommendation</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{alert.ai_suggestion}</p>
              </div>
            </div>
          )}

          {/* Lead Team */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Lead Team
            </label>
            <select
              value={leadTeam}
              onChange={e => setLeadTeam(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary capitalize"
            >
              {TEAMS.map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any context or instructions for the team..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Auto-Generated Tasks */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-3">
              Auto-Generated Tasks
            </label>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary border border-border">
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-foreground flex-1">{task.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${teamColors[task.team] || 'bg-secondary text-muted-foreground border-border'}`}>
                    {task.team}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Impact */}
          {alert.impact && (
            <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="text-yellow-400 font-semibold">Impact: </span>{alert.impact}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0">
          {triggered ? (
            <div className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Protocol Triggered Successfully
            </div>
          ) : (
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {triggering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Triggering Protocol...</>
                : <><Zap className="w-4 h-4" fill="currentColor" /> Trigger Response Protocol</>
              }
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onTrigger }) {
  const cfg  = severityConfig[alert.severity] || severityConfig.info;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.border} bg-card overflow-hidden`}>
      {/* Header */}
      <div className={`${cfg.bg} px-4 py-3`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${cfg.text}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground capitalize">{alert.type}</span>
        </div>
        <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>

        <div className="flex flex-wrap gap-3">
          {alert.train_number && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Train className="w-3 h-3" />
              <span className="font-mono">{alert.train_number}</span>
            </div>
          )}
          {alert.station && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>{alert.station}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>Just now</span>
          </div>
        </div>

        {alert.ai_suggestion && (
          <div className="rounded-lg bg-secondary border border-border px-3 py-2 flex items-start gap-2">
            <Cpu className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-semibold text-blue-400">AI Suggestion</span>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.ai_suggestion}</p>
            </div>
          </div>
        )}

        {alert.impact && (
          <p className="text-xs text-muted-foreground">
            <span className="text-yellow-400 font-medium">Impact:</span> {alert.impact}
          </p>
        )}

        {/* Trigger button */}
        <button
          onClick={() => onTrigger(alert)}
          className="w-full py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" fill="currentColor" />
          Trigger Response Protocol
        </button>
      </div>
    </div>
  );
}

// ─── Main Alerts Page ──────────────────────────────────────────────────────────
export default function Alerts() {
  const [alerts, setAlerts]         = useState([]);
  const [generating, setGenerating] = useState(false);
  const [severity, setSeverity]     = useState('all');
  const [initialized, setInitialized] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null); // alert shown in panel

  const generateAIAlerts = async () => {
    setGenerating(true);
    const trains = simulateTrainStates(Date.now() % 1000);
    const delayed   = trains.filter(t => t.status === 'delayed');
    const highOcc   = trains.filter(t => t.capacity > 0 && (t.passenger_count / t.capacity) > 0.85);
    const highSpeed = trains.filter(t => t.speed_kmh > 180);

    const generated = [];

    if (delayed.length > 0) {
      const t = delayed[0];
      generated.push({
        severity: 'critical', type: 'delay',
        title: `Cascading Delay — ${t.name}`,
        description: `${t.train_number} is running ${t.delay_minutes} minutes late from ${t.current_station} to ${t.next_station}. Risk of cascading delays at downstream platforms.`,
        train_number: t.train_number, station: t.current_station,
        ai_suggestion: `Authorize platform priority at ${t.next_station}. Notify passengers of revised ETA.`,
        impact: `~${Math.round((t.passenger_count || 150) * 0.6)} passengers affected, ${t.delay_minutes}-min delay`,
        resolved: false,
      });
    }
    if (delayed.length > 1) {
      const t = delayed[1];
      generated.push({
        severity: 'critical', type: 'conflict',
        title: `Platform Conflict — ${t.current_station}`,
        description: `${t.train_number} and another service scheduled to arrive simultaneously at ${t.current_station}. Track switching conflict detected.`,
        train_number: t.train_number, station: t.current_station,
        ai_suggestion: `Delay ${t.train_number} departure by 4 minutes. Reassign to alternate platform.`,
        impact: `Platform safety risk, potential 4-6 min delay`,
        resolved: false,
      });
    }
    if (highOcc.length > 0) {
      const t = highOcc[0];
      generated.push({
        severity: 'warning', type: 'anomaly',
        title: `High Occupancy — ${t.name}`,
        description: `${t.train_number} at ${Math.round((t.passenger_count / t.capacity) * 100)}% capacity approaching ${t.next_station}. Overcrowding risk at next boarding stop.`,
        train_number: t.train_number, station: t.next_station,
        ai_suggestion: `Deploy additional staff at ${t.next_station}. Announce next available service.`,
        impact: `Passenger comfort and boarding time affected`,
        resolved: false,
      });
    }
    if (highSpeed.length > 0) {
      const t = highSpeed[0];
      generated.push({
        severity: 'warning', type: 'anomaly',
        title: `Speed Threshold Alert — ${t.train_number}`,
        description: `${t.train_number} operating at ${t.speed_kmh} km/h on segment between ${t.current_station} and ${t.next_station}. Approaching safety threshold.`,
        train_number: t.train_number, station: t.current_station,
        ai_suggestion: `Issue speed advisory to driver. Monitor next 2 segments for compliance.`,
        impact: `Safety risk if speed not reduced within 2 minutes`,
        resolved: false,
      });
    } else {
      generated.push({
        severity: 'info', type: 'maintenance',
        title: 'Scheduled Maintenance Window',
        description: `Preventive track inspection scheduled for ${trains[0]?.current_station || 'Grand Central'} sector 3 during 02:00–04:00. Signal system checks included.`,
        train_number: null, station: trains[0]?.current_station || 'Grand Central',
        ai_suggestion: 'Reroute overnight freight services via alternate corridor. Deploy maintenance crew at 01:45.',
        impact: 'Minimal passenger impact — off-peak window',
        resolved: false,
      });
    }

    const savedAlerts = [];
    try {
      const existing = await base44.entities.Alert.list(null, 20);
      if (existing?.length > 0) {
        await Promise.allSettled(existing.map(a => base44.entities.Alert.delete(a.id)));
      }
      for (const alert of generated) {
        try {
          const saved = await base44.entities.Alert.create(alert);
          savedAlerts.push({ ...alert, id: saved.id || `local-${Date.now()}-${savedAlerts.length}` });
        } catch {
          savedAlerts.push({ ...alert, id: `local-${Date.now()}-${savedAlerts.length}` });
        }
      }
    } catch {
      generated.forEach((a, i) => savedAlerts.push({ ...a, id: `local-${Date.now()}-${i}` }));
    }

    setAlerts(savedAlerts);
    localStorage.setItem('railtwin_alerts', JSON.stringify(savedAlerts));
    setGenerating(false);
    setInitialized(true);
  };

  useEffect(() => { generateAIAlerts(); }, []);

  const filtered = alerts.filter(a => severity === 'all' || a.severity === severity);
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const warnings = alerts.filter(a => a.severity === 'warning').length;
  const info     = alerts.filter(a => a.severity === 'info').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Smart Alert Center</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-sm font-mono text-destructive font-bold">{critical}</span>
              <span className="text-xs text-muted-foreground">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-sm font-mono text-yellow-400 font-bold">{warnings}</span>
              <span className="text-xs text-muted-foreground">Warnings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-sm font-mono text-blue-400 font-bold">{info}</span>
              <span className="text-xs text-muted-foreground">Info</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateAIAlerts} disabled={generating}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${generating ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={generateAIAlerts} disabled={generating} className="bg-blue-500 hover:bg-blue-600 text-white font-medium gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" fill="currentColor" />}
            Generate AI Alerts
          </Button>
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex gap-2">
        {['all', 'critical', 'warning', 'info'].map(s => (
          <button key={s} onClick={() => setSeverity(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              severity === s ? 'bg-blue-500 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert cards */}
      {generating ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-muted-foreground">Analyzing network and generating alerts...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No alerts for this filter. Try "All" or refresh.</p>
            </div>
          ) : (
            filtered.map(alert => (
              <AlertCard key={alert.id} alert={alert} onTrigger={setActiveAlert} />
            ))
          )}
        </div>
      )}

      {/* Incident Response Panel */}
      {activeAlert && (
        <IncidentPanel alert={activeAlert} onClose={() => setActiveAlert(null)} />
      )}
    </div>
  );
}