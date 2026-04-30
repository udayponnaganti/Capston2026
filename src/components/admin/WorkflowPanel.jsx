import { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, Clock, AlertCircle, Loader2, Users, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import moment from 'moment';

const PROTOCOLS = {
  delay: ["Notify passengers", "Investigate cause", "Coordinate platform", "Update schedule"],
  conflict: ["Emergency stop assessment", "Reroute planning", "Passenger communication", "Safety check"],
  maintenance: ["Isolate section", "Deploy crew", "Inspect and repair", "Test and clear"],
  weather: ["Monitor conditions", "Reduce speed advisory", "Station alerts", "Contingency routes"],
  anomaly: ["Data verification", "Physical inspection", "System diagnostic", "Incident log"],
};

const TEAMS = ["mechanical", "electrical", "operations", "safety", "it", "track"];

const taskStatusCycle = { pending: 'in_progress', in_progress: 'done', done: 'blocked', blocked: 'pending' };
const taskStatusIcon = {
  pending: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  done: <CheckCircle2 className="w-4 h-4 text-accent" />,
  blocked: <AlertCircle className="w-4 h-4 text-destructive" />,
};

export default function WorkflowPanel({ alert, onClose }) {
  const [workflow, setWorkflow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState('operations');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWorkflow();
  }, [alert?.id]);

  const loadWorkflow = async () => {
    if (!alert?.id) { setLoading(false); return; }
    setLoading(true);
    const wf = await base44.entities.IncidentWorkflow.filter({ alert_id: alert.id });
    if (wf.length > 0) {
      setWorkflow(wf[0]);
      const t = await base44.entities.WorkflowTask.filter({ workflow_id: wf[0].id });
      setTasks(t);
    }
    setLoading(false);
  };

  const triggerProtocol = async () => {
    setSaving(true);
    const wf = await base44.entities.IncidentWorkflow.create({
      alert_id: alert.id,
      alert_title: alert.title,
      alert_severity: alert.severity,
      alert_type: alert.type,
      train_number: alert.train_number,
      station: alert.station,
      status: 'open',
      priority: alert.severity === 'critical' ? 'p1' : alert.severity === 'warning' ? 'p2' : 'p3',
      assigned_team: team,
      notes,
      protocol: alert.type,
    });
    const protoTasks = (PROTOCOLS[alert.type] || PROTOCOLS.anomaly).map((title, idx) => ({
      workflow_id: wf.id,
      title,
      assigned_team: team,
      status: 'pending',
      priority: idx === 0 ? 'high' : 'medium',
      due_in_minutes: (idx + 1) * 15,
    }));
    const created = await base44.entities.WorkflowTask.bulkCreate(protoTasks);
    setWorkflow(wf);
    setTasks(created);
    setSaving(false);
  };

  const cycleTaskStatus = async (task) => {
    const newStatus = taskStatusCycle[task.status];
    await base44.entities.WorkflowTask.update(task.id, {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : undefined,
    });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  };

  const markResolved = async () => {
    if (!workflow) return;
    await base44.entities.IncidentWorkflow.update(workflow.id, { status: 'resolved', resolved_at: new Date().toISOString() });
    await base44.entities.Alert.update(alert.id, { resolved: true });
    setWorkflow(prev => ({ ...prev, status: 'resolved' }));
    onClose();
  };

  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border-l border-border flex flex-col h-full overflow-auto z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-bold text-foreground">Response Protocol</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{alert?.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {/* Alert summary */}
          <div className={`rounded-xl p-4 border ${alert?.severity === 'critical' ? 'bg-destructive/10 border-destructive/30' : alert?.severity === 'warning' ? 'bg-warning/10 border-warning/30' : 'bg-primary/10 border-primary/30'}`}>
            <p className="text-xs text-muted-foreground">{alert?.description}</p>
            {alert?.ai_suggestion && (
              <p className="text-xs text-accent mt-2">💡 {alert.ai_suggestion}</p>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !workflow ? (
            /* Trigger form */
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Trigger Protocol</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Lead Team</label>
                <select value={team} onChange={e => setTeam(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary capitalize">
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3} placeholder="Add context or notes..." />
              </div>
              <div className="rounded-lg bg-secondary border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Tasks to be created:</p>
                {(PROTOCOLS[alert?.type] || PROTOCOLS.anomaly).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-xs text-muted-foreground font-mono w-4">{i+1}.</span>
                    <span className="text-xs text-foreground">{t}</span>
                  </div>
                ))}
              </div>
              <button onClick={triggerProtocol} disabled={saving}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Trigger Protocol
              </button>
            </div>
          ) : (
            /* Active workflow */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">Team: </span>
                  <span className="text-xs font-medium text-foreground capitalize">{workflow.assigned_team}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground font-mono">{doneCount}/{tasks.length} done</span>
                  <span className="text-xs text-accent font-mono">{progress}%</span>
                </div>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full">
                <div className="h-1.5 bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="space-y-2">
                {tasks.map(task => (
                  <button key={task.id} onClick={() => cycleTaskStatus(task)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary hover:bg-muted transition-all text-left">
                    {taskStatusIcon[task.status]}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{task.status.replace('_',' ')}</span>
                        {task.due_in_minutes && <span className="text-xs text-muted-foreground font-mono">· {task.due_in_minutes}min</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-destructive/15 text-destructive' : task.priority === 'medium' ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'}`}>
                      {task.priority}
                    </span>
                  </button>
                ))}
              </div>
              {workflow.status !== 'resolved' && (
                <button onClick={markResolved}
                  className="w-full py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent hover:text-accent-foreground transition-all">
                  Mark as Resolved
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}