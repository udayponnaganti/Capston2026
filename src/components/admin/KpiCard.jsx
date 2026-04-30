import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiCard({ title, value, unit, icon: Icon, color, trend, trendLabel, subtitle }) {
  const colorMap = {
    blue: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
    teal: { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20', icon: 'text-accent' },
    amber: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', icon: 'text-warning' },
    red: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20', icon: 'text-destructive' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`rounded-xl border ${c.border} bg-card p-5 relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full ${c.bg} opacity-30`} />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={`text-3xl font-bold font-mono ${c.text}`}>{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${c.bg} border ${c.border}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3 relative z-10">
          {trend > 0 ? <TrendingUp className="w-3 h-3 text-accent" /> :
           trend < 0 ? <TrendingDown className="w-3 h-3 text-destructive" /> :
           <Minus className="w-3 h-3 text-muted-foreground" />}
          <span className={`text-xs ${trend > 0 ? 'text-accent' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}