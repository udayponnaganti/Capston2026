import { useState, useEffect } from 'react';
import { useRailTwinStore } from '@/lib/railTwinStore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sliders, TrainTrack, AlertTriangle, PlayCircle, XCircle } from 'lucide-react';

export default function ScenarioSimulator() {
  const store = useRailTwinStore();
  const [selectedTrain, setSelectedTrain] = useState('');
  
  useEffect(() => {
    if (store.trains.length === 0) {
      store.initialize();
    }
    const interval = setInterval(() => {
      store.tick();
    }, 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = (type) => {
    if(!selectedTrain) return;
    store.applyScenario(type, selectedTrain);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scenario Lab</h1>
        <p className="text-muted-foreground mt-1">
          Inject disruptions and observe AI-driven network recovery
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Controls */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Inject Scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {store.activeScenario && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block mb-1">Active Disruption</span>
                  <span className="text-sm">{store.activeScenario}</span>
                </div>
                <button onClick={store.clearScenario} className="text-amber-500 hover:text-amber-400">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Select Target Train</label>
              <select 
                className="w-full bg-background border border-border rounded-lg p-2 text-sm"
                value={selectedTrain}
                onChange={e => setSelectedTrain(e.target.value)}
              >
                <option value="">-- Select Train --</option>
                {store.trains.map(t => (
                  <option key={t.id} value={t.id}>{t.id} ({t.type})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
               <button 
                disabled={!selectedTrain}
                onClick={() => handleApply('minor_delay')}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition"
               >
                 <span className="text-sm">Minor Delay (+15m)</span>
                 <PlayCircle className="w-4 h-4 text-primary" />
               </button>
               <button 
                disabled={!selectedTrain}
                onClick={() => handleApply('major_delay')}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition"
               >
                 <span className="text-sm">Major Delay (+60m)</span>
                 <PlayCircle className="w-4 h-4 text-amber-500" />
               </button>
            </div>
            
          </CardContent>
        </Card>

        {/* Live Network Impact */}
        <Card className="lg:col-span-2 glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Live Impact Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="text-muted-foreground text-sm mb-1">AI Score</div>
                <div className={`text-3xl font-bold ${store.optimizationScore > 80 ? 'text-emerald-400' : store.optimizationScore > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {store.optimizationScore}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="text-muted-foreground text-sm mb-1">Throughput</div>
                <div className="text-3xl font-bold text-blue-400">{store.throughput}%</div>
              </div>
              <div className="p-4 rounded-xl bg-background/50 border border-border">
                <div className="text-muted-foreground text-sm mb-1">Active Conflicts</div>
                <div className="text-3xl font-bold text-amber-500">{store.conflicts.length}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Delay Propagation Network</h3>
              {store.trains.filter(t => t.delayMinutes > 0).length === 0 ? (
                <div className="text-sm text-emerald-500 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                  Network is operating on schedule. No propagating delays.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {store.trains.filter(t => t.delayMinutes > 0).sort((a,b) => b.delayMinutes - a.delayMinutes).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                      <div className="flex items-center gap-3">
                        <TrainTrack className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{t.id}</div>
                          <div className="text-xs text-muted-foreground">{t.currentStation} → {t.nextStation}</div>
                        </div>
                      </div>
                      <div className="text-amber-500 font-mono text-sm font-bold">
                        +{t.delayMinutes}m
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
