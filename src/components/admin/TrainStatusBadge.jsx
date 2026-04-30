export default function TrainStatusBadge({ status, size = 'sm' }) {
  const map = {
    on_time: { label: 'On Time', class: 'bg-accent/15 text-accent border-accent/30' },
    delayed: { label: 'Delayed', class: 'bg-warning/15 text-warning border-warning/30' },
    cancelled: { label: 'Cancelled', class: 'bg-destructive/15 text-destructive border-destructive/30' },
    arrived: { label: 'Arrived', class: 'bg-primary/15 text-primary border-primary/30' },
    departed: { label: 'Departed', class: 'bg-secondary text-muted-foreground border-border' },
  };
  const s = map[status] || map.on_time;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full border font-medium font-mono ${pad} ${s.class}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {s.label}
    </span>
  );
}