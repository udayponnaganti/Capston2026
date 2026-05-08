import { useEffect } from 'react';
import { useRailTwinStore } from '@/lib/railTwinStore';
import {
  BrainCircuit, GitPullRequest, Map, Train, AlertTriangle, Play, Pause, FastForward, CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AIController() {
  const store = useRailTwinStore();
  
  // Initialize and run simulation loop
  useEffect(() => {
    if (store.trains.length === 0) {
      store.initialize();
    }
    
    const interval = setInterval(() => {
      store.tick();
    }, 1000); // tick every second
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeConflicts = store.conflicts.filter(c => c.severity === 'high');
  const recentDecisions = store.decisions.slice(-5).reverse(); // Last 5

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Control Center</h1>
          <p className="text-muted-foreground mt-1">
            New York Division • Real-time Precedence & Conflict Resolution
          </p>
        </div>
        
        {/* Sim Controls */}
        <div className="flex items-center gap-3 glass px-4 py-2 rounded-xl border border-border">
          <div className="flex items-center gap-2 mr-4 border-r border-border pr-4">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">AI Score: {store.optimizationScore}/100</span>
          </div>
          <button onClick={store.toggleSimulation} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            {store.isRunning ? <Pause className="w-5 h-5 text-amber-500" /> : <Play className="w-5 h-5 text-emerald-500" />}
          </button>
          <button onClick={() => store.setSpeed(store.simulationSpeed === 1 ? 5 : 1)} className={`p-2 rounded-lg transition-colors ${store.simulationSpeed > 1 ? 'bg-primary/20 text-primary' : 'hover:bg-secondary'}`}>
            <FastForward className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono w-8 text-right">{store.simulationSpeed}x</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Live Metrics */}
        <Card className="md:col-span-1 glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Map className="w-5 h-5 text-blue-400" />
              Network Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Section Throughput</span>
                <span className="font-bold text-primary">{store.throughput}%</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${store.throughput}%` }} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary/50 p-3 rounded-lg border border-border">
                <div className="text-2xl font-bold text-foreground">{store.trains.filter(t => t.status === 'moving').length}</div>
                <div className="text-xs text-muted-foreground">Active Trains</div>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg border border-border">
                <div className="text-2xl font-bold text-emerald-400">{store.resolvedConflictsCount}</div>
                <div className="text-xs text-muted-foreground">Conflicts Resolved</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Decision Feed */}
        <Card className="md:col-span-2 glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitPullRequest className="w-5 h-5 text-emerald-400" />
              AI Precedence Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDecisions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Scanning network for optimization opportunities...
                </div>
              ) : (
                recentDecisions.map(decision => (
                  <div key={decision.id} className={`p-4 rounded-xl border ${decision.action === 'HOLD' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {decision.action === 'HOLD' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        <span className={`font-bold text-sm ${decision.action === 'HOLD' ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {decision.action} {decision.targetTrain}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(decision.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90">{decision.reason}</p>
                    {decision.explanation && (
                      <div className="mt-3 text-xs bg-background/50 p-2 rounded border border-border text-muted-foreground">
                        <span className="font-semibold text-primary/80 block mb-1">AI Reasoning:</span>
                        {decision.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Section Grid */}
        <Card className="md:col-span-3 glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Train className="w-5 h-5 text-purple-400" />
              Live Section Tracker
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
               {store.sections.map(sec => {
                 // Count trains in section
                 const trainsInSection = store.trains.filter(t => 
                   (t.currentStation === sec.from && t.nextStation === sec.to) ||
                   (t.currentStation === sec.to && t.nextStation === sec.from)
                 ).length;
                 
                 const loadPct = (trainsInSection / sec.capacity) * 100;
                 const statusColor = loadPct === 0 ? 'border-border bg-secondary/20' 
                                   : loadPct < 80 ? 'border-blue-500/30 bg-blue-500/10'
                                   : loadPct <= 100 ? 'border-amber-500/40 bg-amber-500/20'
                                   : 'border-red-500/50 bg-red-500/20';

                 return (
                   <div key={sec.id} className={`p-3 rounded-lg border ${statusColor} flex flex-col justify-between`}>
                     <div className="text-xs font-mono text-muted-foreground mb-2">{sec.from} ↔ {sec.to}</div>
                     <div className="flex justify-between items-end">
                       <div>
                         <div className="text-lg font-bold">{trainsInSection}</div>
                         <div className="text-[10px] uppercase tracking-wider opacity-60">Trains</div>
                       </div>
                       <div className="text-xs font-medium">
                         {loadPct.toFixed(0)}% Cap
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
