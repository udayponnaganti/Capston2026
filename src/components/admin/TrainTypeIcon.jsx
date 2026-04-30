import { Zap, Train, Package, Gauge } from 'lucide-react';

export default function TrainTypeIcon({ type, size = 'sm' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const map = {
    express: { icon: Train, color: 'text-primary' },
    high_speed: { icon: Zap, color: 'text-accent' },
    local: { icon: Gauge, color: 'text-warning' },
    freight: { icon: Package, color: 'text-purple-400' },
  };
  const { icon: Icon, color } = map[type] || map.express;
  return <Icon className={`${s} ${color}`} />;
}