import { useState, useEffect } from 'react';
import { GitBranch, Loader2, Clock, CheckCircle2, AlertCircle, BarChart2, RefreshCw, Zap } from 'lucide-react';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';
import { Button } from '@/components/ui/button';

// ── Config ─────────────────────────────────────────────────────────────────────
const statusConfig = {
  open:        { label: 'Open',        color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  in_progress: { label: 'In Progress', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  resolved:    { label: 'Resolved',    color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/30' },
  closed:      { label: 'Closed',      color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/30' },
};
const severityStyle = {
  critical: 'bg-red-500/20 text-red-400',
  warning:  'bg-yellow-500/15 text-yellow-400',
  info:     'bg-blue-500/15 text-blue-400',
};
const priorityStyle = {
  P1: 'bg-red-500 text-white',
  P2: 'bg-yellow-500 text-black',
  P3: 'bg-slate-600 text-slate-200',
};
const progressBarColor = (pct) =>
  pct === 100 ? 'bg-emerald-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-blue-400';

// ── Local AI Workflow Generator ─────────────────────────────────────────────────
function generateWorkflows(trains) {
  const workflows = [];
  const now = new Date();

  const delayed    = trains.filter(t => t.status === 'delayed').sort((a,b) => b.delay_minutes - a.delay_minutes);
  const highSpeed  = trains.filter(t => t.speed_kmh > 180);
  const highOcc    = trains.filter(t => t.capacity > 0 && (t.occupancy / t.capacity) > 0.85);
  const lowSpeed   = trains.filter(t => t.speed_kmh < 40 && !['arrived','departed','cancelled'].includes(t.status));
  const cancelled  = trains.filter(t => t.status === 'cancelled');

  // ── Platform Conflict from most-delayed trains ─────────────────────
  if (delayed.length >= 2) {
    const t1 = delayed[0], t2 = delayed[1];
    const shared = t1.route.find(s => t2.route.includes(s));
    workflows.push({
      id: 'wf-1',
      title: `Platform Conflict — ${shared || t1.current_station} T${((t1.platform || 1))} & T${((t2.platform || 2) + 1)}`,
      severity: 'critical',
      status: 'in_progress',
      priority: 'P1',
      team: 'Operations',
      tasks_total: 4,
      tasks_done: 2,
      detail: `${t1.train_number} and ${t2.train_number} both delayed and converging at ${shared || t1.current_station}. Platform scheduling conflict detected.`,
      created_ago: `${Math.floor(Math.random()*3+1)} hours ago`,
    });
  }

  // ── Signal / Speed Anomaly ─────────────────────────────────────────
  if (highSpeed.length > 0) {
    const t = highSpeed[0];
    workflows.push({
      id: 'wf-2',
      title: `Signal Anomaly Detected — ${t.current_station} Approach`,
      severity: 'warning',
      status: 'open',
      priority: 'P2',
      team: 'Electrical',
      tasks_total: 4,
      tasks_done: 1,
      detail: `${t.train_number} operating at ${t.speed_kmh} km/h near ${t.current_station}. Speed threshold exceeded — signal compliance check required.`,
      created_ago: `${Math.floor(Math.random()*3+1)} hours ago`,
    });
  } else if (delayed.length > 0) {
    const t = delayed[0];
    workflows.push({
      id: 'wf-2',
      title: `Track Maintenance Required — ${t.current_station}`,
      severity: 'warning',
      status: 'open',
      priority: 'P2',
      team: 'Track',
      tasks_total: 4,
      tasks_done: 0,
      detail: `Repeated delays originating from ${t.current_station} segment. Inspection crew dispatched for track assessment.`,
      created_ago: `${Math.floor(Math.random()*3+2)} hours ago`,
    });
  }

  // ── High Occupancy / Passenger Safety ─────────────────────────────
  if (highOcc.length > 0) {
    const t = highOcc[0];
    const occPct = Math.round((t.occupancy / t.capacity) * 100);
    workflows.push({
      id: 'wf-3',
      title: `High Occupancy Alert — ${t.name} Corridor`,
      severity: 'warning',
      status: 'open',
      priority: 'P2',
      team: 'Passenger Safety',
      tasks_total: 3,
      tasks_done: 0,
      detail: `${t.train_number} at ${occPct}% capacity approaching ${t.next_station}. Risk of overcrowding. Additional services recommended.`,
      created_ago: `${Math.floor(Math.random()*2+1)} hours ago`,
    });
  } else {
    workflows.push({
      id: 'wf-3',
      title: `Severe Weather Advisory — Northern Corridor`,
      severity: 'critical',
      status: 'in_progress',
      priority: 'P1',
      team: 'Safety',
      tasks_total: 4,
      tasks_done: 1,
      detail: `Wind gusts reported on northern segments. Speed restrictions applied to ${
        trains.filter(t => t.route.includes('Northfield Park') || t.route.includes('Riverside Hub')).map(t => t.train_number).slice(0,2).join(', ') || 'affected trains'
      }.`,
      created_ago: `${Math.floor(Math.random()*4+1)} hours ago`,
    });
  }

  // ── Cascading Delay Resolved ───────────────────────────────────────
  if (delayed.length >= 3) {
    const t = delayed[2];
    workflows.push({
      id: 'wf-4',
      title: `${t.delay_minutes}-Min Delay — ${t.name} Network Impact`,
      severity: 'warning',
      status: 'resolved',
      priority: 'P3',
      team: 'Operations',
      tasks_total: 4,
      tasks_done: 4,
      detail: `${t.train_number} running ${t.delay_minutes} min late. Knock-on delays resolved at ${t.next_station}. Services now stabilising.`,
      created_ago: `${Math.floor(Math.random()*5+2)} hours ago`,
    });
  } else {
    workflows.push({
      id: 'wf-4',
      title: `30-Min Delay — Express Network Weather Impact`,
      severity: 'warning',
      status: 'resolved',
      priority: 'P3',
      team: 'Operations',
      tasks_total: 4,
      tasks_done: 4,
      detail: `Weather-induced delays across express corridor now resolved. All affected trains rerouted and passengers informed.`,
      created_ago: `${Math.floor(Math.random()*5+2)} hours ago`,
    });
  }

  // ── IT / System ────────────────────────────────────────────────────
  workflows.push({
    id: 'wf-5',
    title: `IT System Fault — Ticketing Integration`,
    severity: 'info',
    status: 'closed',
    priority: 'P3',
    team: 'IT',
    tasks_total: 4,
    tasks_done: 4,
    detail: `Ticketing API outage affected booking on ${trains.slice(0,2).map(t=>t.train_number).join(', ')}. System restored. Post-mortem scheduled.`,
    created_ago: `${Math.floor(Math.random()*6+3)} hours ago`,
  });

  // ── Low speed / stalled train ──────────────────────────────────────
  if (lowSpeed.length > 0) {
    const t = lowSpeed[0];
    workflows.push({
      id: 'wf-6',
      title: `Stalled Service — ${t.train_number} at ${t.current_station}`,
      severity: 'critical',
      status: 'open',
      priority: 'P1',
      team: 'Operations',
      tasks_total: 3,
      tasks_done: 0,
      detail: `${t.name} (${t.train_number}) travelling at only ${t.speed_kmh} km/h between ${t.current_station} and ${t.next_station}. On-site inspection dispatched.`,
      created_ago: `${Math.floor(Math.random()*2+1)} hours ago`,
    });
  }

  return workflows;
}

// ── WorkflowCard ──────────────────────────────────────────────────────────────
function WorkflowCard({ wf, onClick }) {
  const cfg = statusConfig[wf.status] || statusConfig.open;
  const pct = wf.tasks_total > 0 ? Math.round((wf.tasks_done / wf.tasks_total) * 100) : 0;

  return (
    <button
      onClick={() => onClick(wf)}
      className={`text-left w-full rounded-xl border border-border bg-card p-4 hover:bg-secondary/60 transition-all space-y-3`}
    >
      {/* Title + Priority */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground leading-snug">{wf.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-md font-bold flex-shrink-0 ${priorityStyle[wf.priority] || priorityStyle.P3}`}>
          {wf.priority}
        </span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${severityStyle[wf.severity] || severityStyle.info}`}>
          {wf.severity}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          {cfg.label}
        </span>
        {wf.team && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
            {wf.team}
          </span>
        )}
      </div>

      {/* Tasks + Progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BarChart2 className="w-3 h-3" />
            <span>{wf.tasks_done}/{wf.tasks_total} tasks</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${progressBarColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{wf.created_ago}</p>
    </button>
  );
}

// ── Workflow Detail Modal ─────────────────────────────────────────────────────
const STATUS_CYCLE = ['open', 'in_progress', 'resolved', 'closed'];

function WorkflowDetail({ wf, onClose, onUpdate }) {
  if (!wf) return null;

  // Local state so edits are live inside the modal
  const [localStatus, setLocalStatus]   = useState(wf.status);
  const [tasksDone,   setTasksDone]     = useState(wf.tasks_done);
  const [saved,       setSaved]         = useState(false);

  const cfg  = statusConfig[localStatus] || statusConfig.open;
  const pct  = wf.tasks_total > 0 ? Math.round((tasksDone / wf.tasks_total) * 100) : 0;

  const taskLabels = [
    'Assess and document incident',
    'Notify control room supervisor',
    'Deploy on-site response team',
    'Confirm resolution and close ticket',
  ].slice(0, wf.tasks_total);

  // Toggle a task checkbox
  const toggleTask = (i) => {
    setTasksDone(prev => {
      // If clicking the next unchecked task → check it; if clicking a checked task → uncheck all from i onward
      if (i < prev) return i;          // uncheck from this index
      if (i === prev) return prev + 1; // check this one
      return prev;                     // clicking beyond next — no-op
    });
    setSaved(false);
  };

  // Cycle through statuses
  const cycleStatus = () => {
    const idx = STATUS_CYCLE.indexOf(localStatus);
    setLocalStatus(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
    setSaved(false);
  };

  // Persist changes back to parent
  const handleUpdate = () => {
    onUpdate({ ...wf, status: localStatus, tasks_done: tasksDone });
    setSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg glass rounded-2xl p-6 space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${severityStyle[wf.severity]}`}>{wf.severity}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${priorityStyle[wf.priority]}`}>{wf.priority}</span>
            </div>
            <h2 className="text-base font-bold text-foreground">{wf.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{wf.created_ago}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground">✕</button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{wf.detail}</p>

        {/* Status cycler */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
          <button
            onClick={cycleStatus}
            className={`text-xs px-3 py-1 rounded-full font-semibold border transition-all hover:opacity-80 active:scale-95 ${cfg.bg} ${cfg.color} ${cfg.border}`}
          >
            {cfg.label} →
          </button>
          <span className="text-[10px] text-muted-foreground italic">click to cycle</span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">Task Progress</span>
            <span className="text-xs font-mono text-muted-foreground">{tasksDone}/{wf.tasks_total} · {pct}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full mb-4">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${progressBarColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="space-y-2">
            {taskLabels.map((label, i) => {
              const done = i < tasksDone;
              return (
                <button
                  key={i}
                  onClick={() => toggleTask(i)}
                  className="flex items-center gap-3 w-full text-left group hover:bg-secondary/40 rounded-lg px-2 py-1 transition-all"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    done
                      ? 'bg-emerald-400 border-emerald-400 scale-110'
                      : 'border-border group-hover:border-emerald-400/60'
                  }`}>
                    {done && <span className="text-[10px] text-black font-bold">✓</span>}
                  </div>
                  <span className={`text-xs transition-all ${
                    done ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleUpdate}
            className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
              saved
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground'
            }`}
          >
            {saved ? '✓ Saved' : 'Update Status'}
          </button>
          <button onClick={onClose} className="py-2 px-4 rounded-lg bg-secondary border border-border text-muted-foreground text-xs font-semibold hover:text-foreground transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Workflows Page ───────────────────────────────────────────────────────
export default function Workflows() {
  const { trains, syncStatus } = useRealTimeTrains();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedWf, setSelectedWf] = useState(null);

  // Apply updates from the detail modal back into the workflow list
  const handleUpdate = (updated) => {
    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w));
    setSelectedWf(updated); // keep modal open with fresh data
  };

  const generate = (currentTrains = trains) => {
    if (!currentTrains || currentTrains.length === 0) return;
    setLoading(true);
    // Short delay for UX feel
    setTimeout(() => {
      setWorkflows(generateWorkflows(currentTrains));
      setLoading(false);
    }, 900);
  };

  useEffect(() => {
    if (trains.length > 0 && workflows.length === 0) {
      generate(trains);
    }
  }, [trains, workflows.length]);

  const filtered = workflows.filter(w => statusFilter === 'all' || w.status === statusFilter);
  const openCount      = workflows.filter(w => w.status === 'open').length;
  const inProgCount    = workflows.filter(w => w.status === 'in_progress').length;
  const resolvedCount  = workflows.filter(w => w.status === 'resolved').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Incident Workflows</h1>
          <div className="flex items-center gap-5 mt-2">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-mono font-bold text-blue-400">{openCount}</span>
              <span className="text-xs text-muted-foreground">Open</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-mono font-bold text-yellow-400">{inProgCount}</span>
              <span className="text-xs text-muted-foreground">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-mono font-bold text-emerald-400">{resolvedCount}</span>
              <span className="text-xs text-muted-foreground">Resolved</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => generate(trains)} disabled={loading || trains.length === 0}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={() => generate(trains)} disabled={loading || trains.length === 0} className="bg-blue-500 hover:bg-blue-600 text-white font-medium gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" fill="currentColor" />}
            Generate Workflows
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-blue-500 text-white'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}>
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Workflow grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-sm text-muted-foreground">Analyzing network and generating incident workflows...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No workflows for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(wf => (
            <WorkflowCard key={wf.id} wf={wf} onClick={setSelectedWf} />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedWf && (
        <WorkflowDetail
          wf={selectedWf}
          onClose={() => setSelectedWf(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}