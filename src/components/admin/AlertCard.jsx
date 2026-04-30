import { AlertTriangle, Info, XCircle, Cpu, Train, MapPin, Clock } from 'lucide-react';
import moment from 'moment';

const severityConfig = {
  critical: { icon: XCircle, bg: 'bg-destructive/10', border: 'border-destructive/30', text: 'text-destructive', badge: 'bg-destructive/15 text-destructive' },
  warning:  { icon: AlertTriangle, bg: 'bg-warning/10', border: 'border-warning/30', text: 'text-warning', badge: 'bg-warning/15 text-warning' },
  info:     { icon: Info, bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary', badge: 'bg-primary/15 text-primary' },
};

export default function AlertCard({ alert, onTriggerResponse, compact }) {
  const cfg = severityConfig[alert.severity] || severityConfig.info;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.border} bg-card overflow-hidden`}>
      <div className={`${cfg.bg} px-4 py-3 flex items-start gap-3`}>
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>{alert.severity}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">{alert.type}</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">{alert.title}</h3>
        </div>
        {alert.resolved && (
          <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/30">Resolved</span>
        )}
      </div>
      
      {!compact && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">{alert.description}</p>
          
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
            {alert.created_date && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{moment(alert.created_date).fromNow()}</span>
              </div>
            )}
          </div>

          {alert.ai_suggestion && (
            <div className="rounded-lg bg-secondary border border-border px-3 py-2 flex items-start gap-2">
              <Cpu className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-medium text-accent">AI Suggestion</span>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.ai_suggestion}</p>
              </div>
            </div>
          )}

          {alert.impact && (
            <p className="text-xs text-muted-foreground"><span className="text-warning">Impact:</span> {alert.impact}</p>
          )}

          {!alert.resolved && onTriggerResponse && (
            <button onClick={() => onTriggerResponse(alert)}
              className="w-full mt-1 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all">
              Trigger Response Protocol
            </button>
          )}
        </div>
      )}
    </div>
  );
}