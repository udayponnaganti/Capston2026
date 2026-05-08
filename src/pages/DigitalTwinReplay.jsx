import { useState, useEffect } from 'react';
import { useRailTwinStore } from '@/lib/railTwinStore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { History, Play, Pause, FastForward, Clock, TrainTrack, Activity, AlertCircle } from 'lucide-react';

export default function DigitalTwinReplay() {
  const store = useRailTwinStore();
  const [replayIdx, setReplayIdx] = useState(-1); // -1 means live
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);

  useEffect(() => {
    if (store.trains.length === 0) store.initialize();
    const interval = setInterval(() => { store.tick(); }, 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Replay playback logic
  useEffect(() => {
    let interval;
    if (isPlayingReplay && store.historySnapshots.length > 0) {
      interval = setInterval(() => {
        setReplayIdx(prev => {
          if (prev === -1) return 0;
          if (prev >= store.historySnapshots.length - 1) {
            setIsPlayingReplay(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500); // 2x speed for replay viewing
    }
    return () => clearInterval(interval);
  }, [isPlayingReplay, store.historySnapshots.length]);

  const displayedState = replayIdx >= 0 && store.historySnapshots[replayIdx] 
    ? store.historySnapshots[replayIdx] 
    : {
        timestamp: Date.now(),
        trains: store.trains,
        score: store.optimizationScore,
        conflictsCount: store.conflicts.length,
        conflicts: store.conflicts,
        decisions: store.decisions,
        throughput: store.throughput
      };

  const isLive = replayIdx === -1 || replayIdx >= store.historySnapshots.length - 1;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Replay Lab</h1>
          <p className="text-muted-foreground mt-1">
            Analyze historical decisions and train movements
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isLive ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-500 border border-amber-500/30'}`}>
          {isLive ? 'Live Simulation' : 'Historical Replay'}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6">
            
            {/* Scrubber Area */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPlayingReplay(!isPlayingReplay)}
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 transition shadow-lg shadow-primary/20"
              >
                {isPlayingReplay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
              </button>
              
              <div className="flex-1 space-y-2">
                <input 
                  type="range" 
                  min="0" 
                  max={Math.max(0, store.historySnapshots.length - 1)} 
                  value={replayIdx === -1 ? store.historySnapshots.length - 1 : replayIdx}
                  onChange={(e) => {
                    setIsPlayingReplay(false);
                    setReplayIdx(parseInt(e.target.value));
                  }}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{store.historySnapshots.length > 0 ? new Date(store.historySnapshots[0].timestamp).toLocaleTimeString() : '--'}</span>
                  <span>{new Date(displayedState.timestamp).toLocaleTimeString()}</span>
                  <span>Live</span>
                </div>
              </div>
              
              <button 
                onClick={() => setReplayIdx(-1)}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition"
              >
                Go to Live
              </button>
            </div>
            
            {/* Snapshot Data */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="bg-background/50 p-4 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Snapshot AI Score</div>
                <div className="text-2xl font-bold text-primary">{displayedState.score}</div>
              </div>
              <div className="bg-background/50 p-4 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Conflicts at Timestamp</div>
                <div className="text-2xl font-bold text-amber-500">{displayedState.conflictsCount}</div>
              </div>
              <div className="bg-background/50 p-4 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Active Trains</div>
                <div className="text-2xl font-bold text-foreground">{displayedState.trains.length}</div>
              </div>
              <div className="bg-background/50 p-4 rounded-xl border border-border">
                <div className="text-sm text-muted-foreground mb-1">Throughput Snapshot</div>
                <div className="text-2xl font-bold text-blue-400">{displayedState.throughput || 85}%</div>
              </div>
            </div>

            {/* Historical Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              
              {/* Left Column: AI Decisions & Conflicts */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" /> AI Decisions at this Snapshot
                </h3>
                {displayedState.decisions && displayedState.decisions.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {displayedState.decisions.map((d, i) => (
                      <div key={i} className="p-3 bg-secondary/30 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${d.action === 'HOLD' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {d.action}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">{d.targetTrain}</span>
                        </div>
                        <p className="text-xs text-foreground mt-2">{d.explanation}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-secondary/20 rounded-lg border border-border">
                    No active AI interventions at this time.
                  </div>
                )}

                <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2 mt-6">
                  <AlertCircle className="w-4 h-4" /> Active Conflicts
                </h3>
                {displayedState.conflicts && displayedState.conflicts.length > 0 ? (
                  <div className="space-y-2">
                    {displayedState.conflicts.map((c, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-xs text-red-400 font-medium">Conflict in {c.sectionId}</span>
                        <span className="text-xs font-mono text-red-300">{c.trainA} vs {c.trainB}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-emerald-500 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center">
                    Network Clear
                  </div>
                )}
              </div>

              {/* Right Column: Train Positions */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <TrainTrack className="w-4 h-4" /> Train Positions
                </h3>
                <div className="bg-secondary/10 border border-border rounded-xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <div className="space-y-3">
                    {displayedState.trains.map(t => (
                      <div key={t.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                        <div>
                          <div className="text-sm font-bold flex items-center gap-2">
                            {t.id}
                            {t.delayMinutes > 0 && <span className="text-xs text-amber-500">+{t.delayMinutes}m</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {t.currentStation} → {t.nextStation} ({(t.progress * 100).toFixed(0)}%)
                          </div>
                        </div>
                        <div className={`text-xs px-2 py-1 rounded-full border ${
                          t.status === 'moving' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          t.status === 'held' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {t.status.toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}
