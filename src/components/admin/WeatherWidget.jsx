import { useState, useEffect } from 'react';
import { Cloud, Wind, Droplets, AlertTriangle, RefreshCw } from 'lucide-react';

const WEATHER_API_KEY = '7da0446bb5c048eb9601883e98e1ffbf';

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=New York&appid=${WEATHER_API_KEY}&units=metric`
      );
      if (!res.ok) throw new Error('Weather fetch failed');
      const data = await res.json();
      setWeather(data);
    } catch (e) {
      setError('Weather unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 120000);
    return () => clearInterval(interval);
  }, []);

  const getRailImpact = (weather) => {
    if (!weather) return { label: 'Unknown', color: 'text-muted-foreground' };
    const wind = weather.wind?.speed || 0;
    const cond = weather.weather?.[0]?.main || '';
    if (wind > 15 || ['Thunderstorm', 'Snow', 'Blizzard'].includes(cond))
      return { label: 'Severe', color: 'text-destructive', bg: 'bg-destructive/10' };
    if (wind > 8 || ['Rain', 'Drizzle', 'Fog'].includes(cond))
      return { label: 'Caution', color: 'text-warning', bg: 'bg-warning/10' };
    return { label: 'Normal', color: 'text-accent', bg: 'bg-accent/10' };
  };

  const impact = getRailImpact(weather);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Weather — Rail Corridor</span>
        <button onClick={fetchWeather} className="p-1 hover:text-primary transition-colors">
          <RefreshCw className={`w-3 h-3 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-3 bg-secondary rounded animate-pulse" />)}
        </div>
      ) : weather ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img
              src={`https://openweathermap.org/img/wn/${weather.weather?.[0]?.icon}@2x.png`}
              alt="weather"
              className="w-10 h-10"
            />
            <div>
              <div className="text-2xl font-bold font-mono text-foreground">{Math.round(weather.main?.temp)}°C</div>
              <div className="text-xs text-muted-foreground capitalize">{weather.weather?.[0]?.description}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">{weather.wind?.speed} m/s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Droplets className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">{weather.main?.humidity}%</span>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${impact.bg}`}>
            <AlertTriangle className={`w-3 h-3 ${impact.color}`} />
            <span className={`text-xs font-medium ${impact.color}`}>Rail Impact: {impact.label}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}