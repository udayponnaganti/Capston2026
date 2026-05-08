import { create } from 'zustand';
import { generateInitialFleet, NY_SECTIONS, NY_STATIONS } from './newYorkRailData';
import { runOptimizationCycle } from './aiOptimizationEngine';

export const useRailTwinStore = create((set, get) => ({
  // Core state
  trains: [],
  sections: NY_SECTIONS,
  stations: NY_STATIONS,
  conflicts: [],
  decisions: [],
  optimizationScore: 100,
  throughput: 85, // base throughput percentage
  resolvedConflictsCount: 0,
  lastUpdate: Date.now(),
  
  // Scenario settings
  activeScenario: null,
  
  // Simulation control
  isRunning: false,
  simulationSpeed: 1, // 1x, 2x, etc.
  
  // Replay state
  historySnapshots: [],
  
  initialize: () => {
    const initialTrains = generateInitialFleet(20);
    set({ trains: initialTrains, isRunning: true });
    
    // Run initial AI cycle
    const { conflicts, decisions, score, newThroughput } = runOptimizationCycle(initialTrains, NY_SECTIONS);
    set({ conflicts, decisions, optimizationScore: score, throughput: newThroughput });
  },
  
  toggleSimulation: () => set(state => ({ isRunning: !state.isRunning })),
  
  setSpeed: (speed) => set({ simulationSpeed: speed }),
  
  applyScenario: (scenarioType, targetId) => {
    set(state => {
      const newTrains = [...state.trains];
      let scenarioDesc = "";
      
      if (scenarioType === 'minor_delay') {
        const tIdx = newTrains.findIndex(t => t.id === targetId);
        if(tIdx >= 0) {
          newTrains[tIdx] = { ...newTrains[tIdx], delayMinutes: newTrains[tIdx].delayMinutes + 15, status: 'delayed' };
          scenarioDesc = `Added 15m delay to ${newTrains[tIdx].id}`;
        }
      } else if (scenarioType === 'major_delay') {
        const tIdx = newTrains.findIndex(t => t.id === targetId);
        if(tIdx >= 0) {
          newTrains[tIdx] = { ...newTrains[tIdx], delayMinutes: newTrains[tIdx].delayMinutes + 60, status: 'delayed' };
          scenarioDesc = `Added 60m delay to ${newTrains[tIdx].id}`;
        }
      } else if (scenarioType === 'section_block') {
         // Not fully implemented physically yet, but sets the scenario flag
         scenarioDesc = `Section ${targetId} blocked`;
      }
      
      const { conflicts, decisions, score, newThroughput } = runOptimizationCycle(newTrains, state.sections);
      
      return { 
        activeScenario: scenarioDesc, 
        trains: newTrains,
        conflicts,
        decisions,
        optimizationScore: score,
        throughput: newThroughput
      };
    });
  },
  
  clearScenario: () => set({ activeScenario: null }),
  
  tick: () => {
    const state = get();
    if (!state.isRunning) return;
    
    const now = Date.now();
    const dt = (now - state.lastUpdate) / 1000; // seconds
    const speedMult = state.simulationSpeed;
    
    let updatedTrains = state.trains.map(t => {
      if (t.status === 'held') return t; // AI put this train on hold
      
      // Basic movement logic between stations
      let newProgress = t.progress + (0.05 * speedMult * dt);
      let currStation = t.currentStation;
      let nextStation = t.nextStation;
      
      if (newProgress >= 1) {
        // Arrived at next station
        const routeIdx = t.route.indexOf(t.nextStation);
        if (routeIdx < t.route.length - 1) {
          currStation = t.route[routeIdx];
          nextStation = t.route[routeIdx + 1];
          newProgress = 0;
        } else {
          // Finished route, bounce back or hold (simplified: just reverse route)
          t.route = [...t.route].reverse();
          currStation = t.route[0];
          nextStation = t.route[1];
          newProgress = 0;
        }
      }
      
      return { ...t, progress: newProgress, currentStation: currStation, nextStation: nextStation };
    });
    
    // Run AI Optimization
    const aiResult = runOptimizationCycle(updatedTrains, state.sections);
    
    // Apply holds
    const holdIds = aiResult.decisions.filter(d => d.action === 'HOLD').map(d => d.targetTrain);
    
    const delayMap = {};
    if (aiResult.delayIncreases) {
       aiResult.delayIncreases.forEach(d => {
          delayMap[d.trainId] = (delayMap[d.trainId] || 0) + d.amount;
       });
    }

    updatedTrains = updatedTrains.map(t => ({
      ...t,
      delayMinutes: t.delayMinutes + (delayMap[t.id] || 0),
      status: holdIds.includes(t.id) ? 'held' : (t.delayMinutes + (delayMap[t.id] || 0)) > 10 ? 'delayed' : 'moving'
    }));
    
    // Record snapshot every few ticks
    const newSnapshot = { 
      timestamp: now, 
      trains: updatedTrains, 
      score: aiResult.score, 
      conflictsCount: aiResult.conflicts.length,
      conflicts: aiResult.conflicts,
      decisions: aiResult.decisions,
      throughput: aiResult.newThroughput
    };
    const history = [...state.historySnapshots, newSnapshot].slice(-100); // keep last 100
    
    set({
      trains: updatedTrains,
      conflicts: aiResult.conflicts,
      decisions: aiResult.decisions,
      optimizationScore: aiResult.score,
      throughput: aiResult.newThroughput,
      resolvedConflictsCount: state.resolvedConflictsCount + aiResult.resolvedThisTick,
      lastUpdate: now,
      historySnapshots: history
    });
  }
}));
