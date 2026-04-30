import { ArrowRight, Gauge, Users } from 'lucide-react';
import TrainStatusBadge from './TrainStatusBadge';
import TrainTypeIcon from './TrainTypeIcon';

export default function TrainStatusCard({ train, compact }) {
  const occupancy = train.capacity > 0 ? Math.round((train.passenger_count / train.capacity) * 100) : 0;
  const occupancyColor = occupancy > 85 ? 'bg-destructive' : occupancy > 60 ? 'bg-warning' : 'bg-accent';

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary transition-all">
        <TrainTypeIcon type={train.type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">{train.train_number}</span>
            <TrainStatusBadge status={train.status} />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <span className="truncate">{train.current_station}</span>
            <ArrowRight className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{train.next_station}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-foreground">{train.speed_kmh} km/h</span>
          {train.delay_minutes > 0 && (
            <span className="block text-xs text-warning font-mono">+{train.delay_minutes}m</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrainTypeIcon type={train.type} size="md" />
          <div>
            <div className="text-sm font-bold text-foreground">{train.name}</div>
            <div className="text-xs font-mono text-muted-foreground">{train.train_number}</div>
          </div>
        </div>
        <TrainStatusBadge status={train.status} />
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
        <span className="font-medium text-foreground truncate">{train.origin}</span>
        <ArrowRight className="w-3 h-3 flex-shrink-0 text-primary" />
        <span className="font-medium text-foreground truncate">{train.destination}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Speed</div>
          <div className="text-sm font-mono font-bold text-foreground">{train.speed_kmh}</div>
          <div className="text-xs text-muted-foreground">km/h</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Delay</div>
          <div className={`text-sm font-mono font-bold ${train.delay_minutes > 0 ? 'text-warning' : 'text-accent'}`}>
            {train.delay_minutes > 0 ? `+${train.delay_minutes}` : '0'}
          </div>
          <div className="text-xs text-muted-foreground">min</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Platform</div>
          <div className="text-sm font-mono font-bold text-foreground">{train.platform || '—'}</div>
        </div>
      </div>

      {train.type !== 'freight' && train.capacity > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>Occupancy</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{train.passenger_count}/{train.capacity}</span>
          </div>
          <div className="w-full h-1.5 bg-secondary rounded-full">
            <div className={`h-1.5 rounded-full transition-all ${occupancyColor}`} style={{ width: `${Math.min(occupancy, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}