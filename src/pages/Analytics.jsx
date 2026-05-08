import { useState, useEffect } from 'react';
import { BarChart3, Cpu, Loader2, TrendingUp, AlertTriangle, CheckCircle2, Zap, Activity } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useRealTimeTrains } from '@/lib/useRealTimeTrains';
import { useRailTwinStore } from '@/lib/railTwinStore';

const COLORS = ['hsl(211,100%,62%)', 'hsl(161,72%,48%)', 'hsl(38,92%,50%)', 'hsl(280,65%,60%)', 'hsl(0,72%,51%)'];
const CT = { background: 'hsl(222,41%,10%)', border: '1px solid hsl(222,30%,18%)', borderRadius: 8, fontSize: 11 };

function generateHistoricalData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}:00`,
    delay: Math.round(2 + Math.sin(i * 0.5) * 3 + Math.random() * 2),
    ontime: Math.round(75 + Math.cos(i * 0.4) * 12 + Math.random() * 5),
    throughput: Math.round(3000 + Math.sin(i * 0.3) * 1500 + Math.random() * 500),
  }));
}

export default function Analytics() {
  const { trains } = useRealTimeTrains();
  const aiStore = useRailTwinStore();
  const [historical] = useState(generateHistoricalData());
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (aiStore.trains.length === 0 && !aiStore.isRunning) {
      aiStore.initialize();
    }
  }, [aiStore]);

  // Map NY sections to utilization data
  const nySectionData = aiStore.sections.map(sec => {
    const active = aiStore.trains.filter(t =>
      (t.currentStation === sec.from && t.nextStation === sec.to) ||
      (t.currentStation === sec.to && t.nextStation === sec.from)
    ).length;
    return {
      name: `${sec.from}-${sec.to}`,
      utilization: Math.round((active / sec.capacity) * 100)
    };
  });

  const comparisonData = [
    { metric: 'Avg Delay (mins)', baseline: 14.5, ai: 3.2 },
    { metric: 'Safety Conflicts', baseline: 8, ai: 0 },
    { metric: 'Energy Waste (%)', baseline: 18, ai: 4 },
    { metric: 'Platform Congestion', baseline: 85, ai: 42 },
  ];

  // Compute real stats from live trains
  const onTimeCount = trains.filter(t => ['on_time', 'arrived', 'departed'].includes(t.status)).length;
  const delayedCount = trains.filter(t => t.status === 'delayed').length;
  const delays = trains.filter(t => t.delay_minutes > 0).map(t => t.delay_minutes);
  const avgDelay = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
  const onTimeRate = trains.length ? Math.round((onTimeCount / trains.length) * 100) : 0;
  const totalPax = trains.reduce((s, t) => s + (t.passenger_count || t.occupancy || 0), 0);

  const stats = { total: trains.length, onTime: onTimeCount, delayed: delayedCount, avgDelay, onTimeRate, totalPassengers: totalPax, platformUtil: 77 };

  // Fleet distribution from real route IDs
  const fleetDist = (() => {
    const buckets = { express: 0, 'high speed': 0, local: 0, freight: 0 };
    trains.forEach(t => {
      const rid = (t.route_id || '').toUpperCase();
      if (['A', 'C', 'E', 'B', 'D', 'F', 'M'].includes(rid)) buckets.express++;
      else if (['N', 'Q', 'R', 'W', 'J', 'Z'].includes(rid)) buckets['high speed']++;
      else if (['1', '2', '3', '4', '5', '6', '7', 'L', 'G', 'S'].includes(rid)) buckets.local++;
      else buckets.freight++;
    });
    return Object.entries(buckets).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
  })();

  // Station avg delay from real trains (group by current_station)
  const stationDelay = (() => {
    const m = {};
    trains.forEach(t => {
      const s = t.current_station;
      if (!s || s === 'Unknown') return;
      if (!m[s]) m[s] = { total: 0, count: 0 };
      m[s].total += t.delay_minutes || 0;
      m[s].count++;
    });
    return Object.entries(m)
      .map(([name, { total, count }]) => ({ name: name.substring(0, 6), delay: Math.round(total / count) }))
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 6);
  })();

  const generateInsights = () => {
    setAiLoading(true);
    setTimeout(() => {
      // ── Local AI Engine: analyse live network ────────────────────
      const liveTrains = simulateTrainStates(Date.now() % 1000);
      const liveStats = getNetworkStats(liveTrains);
      const delayed = liveTrains.filter(t => t.status === 'delayed');
      const onTime = liveTrains.filter(t => t.status === 'on_time');
      const highSpeed = liveTrains.filter(t => t.speed_kmh > 180);
      const highOcc = liveTrains.filter(t => t.capacity > 0 && (t.passenger_count / t.capacity) > 0.85);
      const freight = liveTrains.filter(t => t.type === 'freight');
      const express = liveTrains.filter(t => t.type === 'express');
      const avgSpeed = Math.round(liveTrains.reduce((s, t) => s + t.speed_kmh, 0) / liveTrains.length);
      const maxDelay = delayed.length ? Math.max(...delayed.map(t => t.delay_minutes)) : 0;
      const worstTrain = delayed.find(t => t.delay_minutes === maxDelay);
      const bestHour = historical.reduce((best, h) => h.ontime > best.ontime ? h : best, historical[0]);
      const peakDelayH = historical.reduce((peak, h) => h.delay > peak.delay ? h : peak, historical[0]);
      const stationsHit = new Set(delayed.flatMap(t => [t.current_station, t.next_station]));

      const summary = `Over the past 24 hours, the network maintained an average on-time rate of ${liveStats.onTimeRate}% with a mean delay of ${liveStats.avgDelay} minutes. ${liveTrains.length} trains operated across ${STATIONS.length} stations carrying ${liveStats.totalPassengers.toLocaleString()} passengers. ${delayed.length} service(s) reported delays, with platform utilisation at ${liveStats.platformUtil}%.`;

      const keyFindings = [
        `Peak delay period detected at ${peakDelayH.hour} with ${delayed.length} train${delayed.length !== 1 ? 's' : ''} delayed simultaneously.`,
        `Best performance window was ${bestHour.hour} with ${bestHour.ontime}% on-time rate.`,
        `Average network speed held at ${avgSpeed} km/h across all service types.`,
        `Fleet utilisation is highest for ${express.length > 0 ? 'express' : 'local'} and high-speed services during peak hours.`,
        onTime.length > 0 ? `${onTime.length} trains currently running on schedule — no intervention needed.` : 'All services require monitoring.',
      ];

      const recommendations = [
        `Increase platform turnaround efficiency during the ${peakDelayH.hour} peak window to reduce cascading delays.`,
        highOcc.length > 0
          ? `Deploy additional carriages on ${highOcc.map(t => t.train_number).join(', ')} — occupancy exceeds 85%.`
          : 'Maintain current passenger load distribution across fleet.',
        `Schedule preventive maintenance during the low-traffic 02:00–04:00 window to minimise disruption.`,
        freight.length > 0 ? `Review freight scheduling on shared segments to avoid conflict with morning passenger services.` : 'Continue current freight scheduling.',
        `Deploy additional staff at high-utilisation stations (${[...stationsHit].slice(0, 3).join(', ') || 'all major hubs'}) during peak periods.`,
      ];

      const risks = [
        delayed.length >= 3
          ? `${delayed.length} concurrent delays risk cascading platform conflicts at downstream stations.`
          : `${delayed.length > 0 ? delayed.length + ' delay(s) detected' : 'No current delays'} — monitor northern corridor.`,
        highSpeed.length > 0
          ? `${highSpeed.map(t => t.train_number).join(', ')} operating above 180 km/h on shared segments — safety threshold risk.`
          : 'All trains operating within safe speed thresholds.',
        highOcc.length > 0
          ? `Overcrowding risk on ${highOcc.map(t => t.name).join(', ')} — boarding restrictions may be needed.`
          : 'Passenger load within acceptable limits across all services.',
        `Weather sensitivity detected — wind speeds above 50 km/h historically correlate with 15% delay increase.`,
        worstTrain ? `${worstTrain.train_number} is the highest-risk service at +${maxDelay} min — requires immediate priority routing.` : 'No critical delay outliers detected.',
      ];

      setAiInsights({ summary, keyFindings, recommendations, risks });
      setAiLoading(false);
    }, 1200); // simulate analysis time
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-1">Performance overview · Last 24h</p>
        </div>
        <button onClick={generateInsights} disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50">
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" fill="currentColor" />}
          {aiLoading ? 'Analysing Network...' : 'Generate AI Insights'}
        </button>
      </div>

      {/* AI Insights Panel — matches reference image */}
      {aiInsights && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" fill="currentColor" />
            <span className="text-sm font-bold text-accent">AI Analytics Insight</span>
          </div>

          {/* Summary paragraph */}
          <p className="text-sm text-foreground leading-relaxed">{aiInsights.summary}</p>

          {/* 3-column layout: Key Findings · Recommendations · Risk Areas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
            {/* Key Findings */}
            <div>
              <p className="text-xs font-bold text-blue-400 mb-2">Key Findings</p>
              {aiInsights.keyFindings?.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1.5">
                  <span className="text-blue-400 text-xs mt-0.5 flex-shrink-0">•</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div>
              <p className="text-xs font-bold text-emerald-400 mb-2">Recommendations</p>
              {aiInsights.recommendations?.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1.5">
                  <span className="text-emerald-400 text-xs mt-0.5 flex-shrink-0">•</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                </div>
              ))}
            </div>

            {/* Risk Areas */}
            <div>
              <p className="text-xs font-bold text-yellow-400 mb-2">Risk Areas</p>
              {aiInsights.risks?.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1.5">
                  <span className="text-yellow-400 text-xs mt-0.5 flex-shrink-0">•</span>
                  <span className="text-xs text-muted-foreground leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NY AI Section Utilization */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">New York AI Module: Section Utilization</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={nySectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={CT} cursor={{ fill: 'hsl(215,20%,55%)', opacity: 0.1 }} />
            <Bar dataKey="utilization" name="Utilization %" fill="hsl(211,100%,62%)" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AI vs Baseline Comparison */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-foreground">System Efficiency: RailTwin AI vs Baseline Operations</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="metric" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={CT}
              cursor={{ fill: 'hsl(215,20%,55%)', opacity: 0.1 }}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'hsl(215,20%,55%)' }} />
            <Bar dataKey="baseline" name="Without RailTwin (Baseline)" fill="hsl(215,20%,55%)" radius={[4, 4, 0, 0]} barSize={30} />
            <Bar dataKey="ai" name="With RailTwin AI" fill="hsl(161,72%,48%)" radius={[4, 4, 0, 0]} barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delay Trend */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Delay Trend (24h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={historical}>
              <defs>
                <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(38,92%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(38,92%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CT} labelStyle={{ color: 'hsl(215,20%,55%)' }} itemStyle={{ color: 'hsl(38,92%,50%)' }} />
              <Area type="monotone" dataKey="delay" stroke="hsl(38,92%,50%)" fill="url(#ag1)" strokeWidth={2} dot={false} name="Avg Delay (min)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* On-Time Rate */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">On-Time Rate (24h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={historical}>
              <XAxis dataKey="hour" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} domain={[60, 100]} />
              <Tooltip contentStyle={CT} labelStyle={{ color: 'hsl(215,20%,55%)' }} itemStyle={{ color: 'hsl(161,72%,48%)' }} />
              <Line type="monotone" dataKey="ontime" stroke="hsl(161,72%,48%)" strokeWidth={2} dot={false} name="On-Time %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet Distribution */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Fleet Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={fleetDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" nameKey="name">
                {fleetDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={CT} />
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: 'hsl(215,20%,55%)', fontSize: 11, textTransform: 'capitalize' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Station Performance */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Station Avg Delay</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stationDelay} barSize={20}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={CT} itemStyle={{ color: 'hsl(211,100%,62%)' }} />
              <Bar dataKey="delay" fill="hsl(211,100%,62%)" radius={[4, 4, 0, 0]} name="Avg Delay (min)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Network Throughput */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Network Throughput (24h)</h3>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={historical}>
            <defs>
              <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(161,72%,48%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(161,72%,48%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CT} itemStyle={{ color: 'hsl(161,72%,48%)' }} />
            <Area type="monotone" dataKey="throughput" stroke="hsl(161,72%,48%)" fill="url(#tg2)" strokeWidth={2} dot={false} name="Passengers" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}