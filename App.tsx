import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { fetchWeather, searchLocation, reverseGeocode, getWeatherDescription } from './services/weatherService';
import { getAIInsight } from './services/geminiService';
import { WeatherData, GeocodingResult, SavedLocation } from './types';
import { WeatherIconLarge } from './components/WeatherIcons';
import { Analytics } from "@vercel/analytics/react";

type Theme = 'light' | 'dark' | 'midnight';
type ChartRange = 6 | 12 | 24;

const CACHE_KEY_WEATHER = 'skycast_weather_cache';
const CACHE_KEY_INSIGHT = 'skycast_insight_cache';
const CACHE_KEY_CONSENT = 'skycast_consent_granted';
const WEATHER_TTL = 15 * 60 * 1000;

const App: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showLegal, setShowLegal] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | 'data' | 'security' | 'ip'>('terms');
  const [chartRange, setChartRange] = useState<ChartRange>(24);
  const [showConsent, setShowConsent] = useState(() => !localStorage.getItem(CACHE_KEY_CONSENT));
  const [showLocationExplain, setShowLocationExplain] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsResults, setSettingsResults] = useState<GeocodingResult[]>([]);
  const [defaultLocation, setDefaultLocation] = useState<SavedLocation | null>(() => {
    const saved = localStorage.getItem('defaultLocation');
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'midnight') return saved;
    return 'midnight';
  });
  const [unit, setUnit] = useState<'C' | 'F'>(() => {
    return (localStorage.getItem('tempUnit') as 'C' | 'F') || 'C';
  });

  const settingsRef = useRef<HTMLDivElement>(null);

  const formatTemp = (celsius: number) => {
    const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
    return Math.round(value);
  };

  const getCache = (key: string) => {
    const item = localStorage.getItem(key);
    if (!item) return null;
    try { return JSON.parse(item); } catch { return null; }
  };

  const setCache = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  };

  const isCacheValid = (timestamp: number, ttl: number) => (Date.now() - timestamp) < ttl;

  useEffect(() => {
    if (weather) {
      const locationName = weather.location.name;
      const desc = getWeatherDescription(weather.current.weatherCode);
      const temp = formatTemp(weather.current.temp);
      const condition = desc.text;
      document.title = `${locationName} Weather - ${temp}°${unit} | SkyCast AI`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', `Forecast for ${locationName}. ${temp}°${unit}, ${condition}. AI insights and 7-day telemetry.`);
      }
    }
  }, [weather, unit]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'midnight');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : (prev === 'dark' ? 'midnight' : 'light'));
  };

  const toggleUnit = () => {
    setUnit(prev => {
      const next = prev === 'C' ? 'F' : 'C';
      localStorage.setItem('tempUnit', next);
      return next;
    });
  };

  const updateAiInsight = async (data: WeatherData, forceRefresh = false) => {
    const cached = getCache(CACHE_KEY_INSIGHT);
    if (!forceRefresh && cached && isCacheValid(cached.timestamp, WEATHER_TTL)) {
      setAiInsight(cached.data);
      return;
    }
    setIsAiLoading(true);
    const insight = await getAIInsight(data); 
    setAiInsight(insight);
    setCache(CACHE_KEY_INSIGHT, insight);
    setIsAiLoading(false);
  };

  const loadWeather = useCallback(async (lat: number, lon: number, name: string, country: string, forceRefresh = false) => {
    const cachedWeather = getCache(CACHE_KEY_WEATHER);
    if (!forceRefresh && cachedWeather && isCacheValid(cachedWeather.timestamp, WEATHER_TTL)) {
      const data = cachedWeather.data as WeatherData;
      if (Math.abs(data.location.latitude - lat) < 0.05 && Math.abs(data.location.longitude - lon) < 0.05) {
        setWeather(data);
        setLoading(false);
        updateAiInsight(data);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon, name, country);
      setWeather(data);
      setCache(CACHE_KEY_WEATHER, data);
      updateAiInsight(data, true);
    } catch (err) {
      setError('Telemetry link failed. Check connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by client.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const info = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, info.name, info.country);
        setShowLocationExplain(false);
      },
      () => {
        if (defaultLocation) {
          loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.name, defaultLocation.country);
        } else {
          setError('Location access denied. Use search or set home anchor.');
          setLoading(false);
        }
        setShowLocationExplain(false);
      }
    );
  };

  useEffect(() => {
    if (defaultLocation) {
      loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.name, defaultLocation.country);
    } else {
      const cached = getCache(CACHE_KEY_WEATHER);
      if (cached && isCacheValid(cached.timestamp, WEATHER_TTL)) {
        loadWeather(cached.data.location.latitude, cached.data.location.longitude, cached.data.location.name, cached.data.location.country);
      } else {
        setLoading(false); 
      }
    }
  }, [defaultLocation, loadWeather]);

  const deleteUserData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const acceptConsent = () => {
    localStorage.setItem(CACHE_KEY_CONSENT, 'true');
    setShowConsent(false);
  };

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length > 2) {
      const results = await searchLocation(val);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectLocation = (loc: GeocodingResult) => {
    setSearchQuery('');
    setSearchResults([]);
    loadWeather(loc.latitude, loc.longitude, loc.name, loc.country, true);
  };

  const handleSettingsSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSettingsSearch(val);
    if (val.length > 2) {
      const results = await searchLocation(val);
      setSettingsResults(results);
    } else {
      setSettingsResults([]);
    }
  };

  const handleSetDefaultLocation = (loc: GeocodingResult) => {
    const saved: SavedLocation = { ...loc };
    setDefaultLocation(saved);
    localStorage.setItem('defaultLocation', JSON.stringify(saved));
    setSettingsSearch('');
    setSettingsResults([]);
    loadWeather(loc.latitude, loc.longitude, loc.name, loc.country, true);
    setShowSettings(false);
  };

  if (loading && !weather) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-blue-500">
        <div className="w-16 h-16 border-4 border-blue-500/10 rounded-full relative">
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 font-black tracking-widest uppercase text-[10px]">Syncing Legal & Atmospheric Compliance</p>
      </div>
    );
  }

  const desc = weather ? getWeatherDescription(weather.current.weatherCode) : null;
  const isLight = theme === 'light';
  const atmosphericGradient = desc?.bg || 'from-slate-900 to-black';

  const chartData = weather ? weather.hourly.time.map((time, i) => ({
    time: new Date(time).getHours() + ":00",
    temp: formatTemp(weather.hourly.temperature[i]),
    precip: weather.hourly.precipitation[i],
    code: weather.hourly.weatherCode[i],
    displayTime: new Date(time).toLocaleTimeString('en-US', { hour: 'numeric' }),
    rawDate: new Date(time)
  })).slice(0, chartRange) : [];

  return (
    <div className={`min-h-screen relative overflow-hidden transition-all duration-1000 ${isLight ? 'text-slate-900' : 'text-white'} p-3 md:p-6`}>
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none z-0 ${theme === 'midnight' ? 'opacity-100 bg-black' : 'opacity-0'}`} />
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none z-0 ${isLight ? 'opacity-100 bg-slate-50' : 'opacity-0'}`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${atmosphericGradient} transition-opacity duration-1000 pointer-events-none z-0`} style={{ opacity: theme === 'dark' ? 1 : 0 }} />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <button 
            onClick={() => setShowLocationExplain(true)} 
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl p-1"
            aria-label="Refresh current location weather"
          >
            <div className={`${!isLight ? 'bg-white/10' : 'bg-blue-600'} p-2 rounded-xl shadow-xl transition-all group-hover:scale-110`}>
              <i className="fa-solid fa-wind text-xl text-white"></i>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black leading-none tracking-tighter">SkyCast</h1>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Secure Neural Link</span>
            </div>
          </button>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <nav className="relative flex-1 sm:w-80 group">
              <i className={`fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 ${!isLight ? 'text-white/30' : 'text-slate-400'}`}></i>
              <input
                type="text"
                aria-label="Search city atmosphere"
                className={`w-full rounded-2xl py-2.5 pl-12 pr-6 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isLight ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-slate-200 text-slate-900 shadow-sm'}`}
                placeholder="Query atmosphere..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchResults.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl ${!isLight ? 'glass-card' : 'bg-white border border-slate-100'}`}>
                  {searchResults.map((res, idx) => (
                    <button key={idx} onClick={() => handleSelectLocation(res)} className="w-full text-left px-5 py-3 border-b last:border-0 flex flex-col hover:bg-blue-500/10 focus:bg-blue-500/10 focus:outline-none">
                      <span className="font-bold text-sm">{res.name}</span>
                      <span className="text-[8px] uppercase tracking-widest opacity-50">{res.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={cycleTheme} 
                className={`p-2.5 rounded-xl shadow-xl active:scale-90 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isLight ? 'bg-white/10 text-amber-400' : 'bg-white text-indigo-600'}`}
                aria-label="Switch interface theme"
              >
                <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : (theme === 'dark' ? 'fa-moon' : 'fa-circle-half-stroke')} text-lg`}></i>
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowSettings(!showSettings)} 
                  className={`p-2.5 rounded-xl shadow-xl active:scale-90 focus:outline-none focus:ring-2 focus:ring-blue-500 ${!isLight ? 'bg-white/10 text-blue-400' : 'bg-white text-blue-600'}`}
                  aria-label="System configuration"
                >
                  <i className="fa-solid fa-gear text-lg"></i>
                </button>
                {showSettings && (
                  <div ref={settingsRef} className={`absolute top-full right-0 mt-4 w-72 md:w-80 rounded-[2rem] p-6 z-[100] shadow-2xl ${!isLight ? 'glass-card' : 'bg-white border border-slate-100'}`}>
                    <h4 className="text-xs font-black uppercase tracking-widest opacity-50 mb-4">System Config</h4>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Home Anchor</label>
                        <input
                          type="text"
                          placeholder="Set default city..."
                          className={`w-full rounded-xl py-2.5 px-4 text-xs focus:outline-none border ${!isLight ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          value={settingsSearch}
                          onChange={handleSettingsSearchChange}
                        />
                        {settingsResults.length > 0 && (
                          <div className={`absolute left-6 right-6 mt-1 rounded-xl overflow-hidden z-[110] border ${!isLight ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                            {settingsResults.map((res, idx) => (
                              <button key={idx} onClick={() => handleSetDefaultLocation(res)} className="w-full text-left px-4 py-2 text-[10px] hover:bg-blue-500/10">
                                {res.name}, {res.country}
                              </button>
                            ))}
                          </div>
                        )}
                        {defaultLocation && (
                          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            <span className="text-[10px] font-black text-blue-500">{defaultLocation.name}</span>
                            <button onClick={() => { localStorage.removeItem('defaultLocation'); setDefaultLocation(null); }} className="text-rose-500"><i className="fa-solid fa-trash-can"></i></button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase opacity-40">Thermal Scale</span>
                        <button onClick={toggleUnit} className="px-3 py-1.5 rounded-lg font-black text-[10px] bg-blue-500/10 text-blue-500">{unit === 'C' ? 'CELSIUS' : 'FAHRENHEIT'}</button>
                      </div>
                      
                      {/* Prominent Legal Hub Access */}
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <button 
                          onClick={() => { setLegalTab('privacy'); setShowLegal(true); setShowSettings(false); }} 
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 text-blue-500 font-black text-[10px] uppercase group hover:bg-blue-500 hover:text-white transition-all"
                        >
                          <span className="flex items-center gap-2"><i className="fa-solid fa-shield-halved"></i> Privacy & Compliance</span>
                          <i className="fa-solid fa-chevron-right text-[8px]"></i>
                        </button>
                        <button 
                          onClick={() => { setLegalTab('data'); setShowLegal(true); setShowSettings(false); }} 
                          className="w-full py-2.5 rounded-xl border border-rose-500/20 text-rose-500 font-black text-[10px] uppercase hover:bg-rose-500/10"
                        >
                          Manage My Data
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {weather ? (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-8 space-y-5">
              <article className="glass-card rounded-[2rem] p-6 relative overflow-hidden" aria-labelledby="current-weather-title">
                <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h2 id="current-weather-title" className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{weather.location.name}</h2>
                    </div>
                    <p className="text-sm font-medium opacity-50 uppercase tracking-[0.3em]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    <div className="pt-4 flex items-center gap-4">
                      <span className="text-7xl md:text-9xl font-black tracking-tighter leading-none">{formatTemp(weather.current.temp)}°</span>
                      <div className="flex flex-col gap-3">
                         <div className="flex items-center gap-3">
                           <div className={`relative w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all ${!isLight ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                              <div className="w-full h-full absolute inset-0 flex items-center justify-center transition-transform duration-[1500ms]" style={{ transform: `rotate(${weather.current.windDirection}deg)` }}>
                                <div className="w-[2px] h-8 bg-blue-500 relative">
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-l-[4px] border-r-[4px] border-b-[8px] border-b-blue-500 border-transparent"></div>
                                </div>
                              </div>
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase">{weather.current.windSpeed} km/h</span>
                              <span className="text-[8px] font-bold opacity-30 uppercase">Wind Dir: {weather.current.windDirection}°</span>
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <WeatherIconLarge code={weather.current.weatherCode} className="text-8xl md:text-9xl mb-4 drop-shadow-2xl animate-float" />
                    <p className="text-3xl font-black uppercase tracking-tighter">{desc?.text}</p>
                  </div>
                </div>
              </article>

              <section className="glass-card rounded-[2rem] p-6 shadow-xl">
                <div className="h-56 w-full" aria-label="Hourly temperature chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={!isLight ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} />
                      <XAxis dataKey="time" strokeOpacity={0.4} fontSize={8} fontWeight={900} />
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', background: 'rgba(0,0,0,0.8)', color: 'white' }} />
                      <Area type="monotone" dataKey="temp" stroke="#3b82f6" strokeWidth={3} fillOpacity={0.2} fill="#3b82f6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="ai-glow backdrop-blur-3xl rounded-3xl p-8 shadow-xl" aria-live="polite">
                 <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-sparkles text-blue-500"></i> AI Forecast Analysis
                 </h3>
                 {isAiLoading ? <div className="h-4 w-3/4 bg-blue-500/10 rounded animate-pulse"></div> : <p className="text-base font-medium leading-relaxed italic opacity-80">{aiInsight}</p>}
              </div>
            </section>

            <aside className="lg:col-span-4 h-full">
              <section className="glass-card rounded-[2rem] p-6 h-full shadow-2xl" aria-label="7-day outlook">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 mb-8">7-Day Delta</h3>
                <div className="space-y-3">
                  {weather.daily.time.map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors">
                      <div className="w-20"><p className="text-xs font-black">{idx === 0 ? 'Today' : new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}</p></div>
                      <i className={`fa-solid ${getWeatherDescription(weather.daily.weatherCode[idx]).icon} text-xl text-blue-500`}></i>
                      <div className="flex gap-4"><span className="text-sm font-black">{formatTemp(weather.daily.tempMax[idx])}°</span><span className="text-sm font-black opacity-40">{formatTemp(weather.daily.tempMin[idx])}°</span></div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </main>
        ) : (
          <div className="text-center py-20 opacity-50"><p className="text-xs font-black uppercase tracking-[0.5em]">System Idle. Select coordinates.</p></div>
        )}
      </div>

      <footer className="max-w-7xl mx-auto mt-12 mb-6 text-center border-t border-white/5 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12 text-left px-6">
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Compliance & Data</h5>
            <p className="text-[10px] leading-relaxed opacity-40 font-bold uppercase">
              Atmospheric data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 underline">Open-Meteo</a>. 
              Reverse geocoding by <a href="https://www.bigdatacloud.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 underline">BigDataCloud</a>.
              All telemetry transmitted via secure HTTPS protocols.
            </p>
          </div>
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Legal Documents</h5>
            <nav className="flex flex-col gap-2">
              <button onClick={() => { setLegalTab('privacy'); setShowLegal(true); }} className="text-[10px] text-left opacity-40 hover:opacity-100 font-bold uppercase transition-all">Privacy Policy (GDPR/CCPA)</button>
              <button onClick={() => { setLegalTab('terms'); setShowLegal(true); }} className="text-[10px] text-left opacity-40 hover:opacity-100 font-bold uppercase transition-all">Terms of Service</button>
              <button onClick={() => { setLegalTab('ip'); setShowLegal(true); }} className="text-[10px] text-left opacity-40 hover:opacity-100 font-bold uppercase transition-all">Intellectual Property</button>
            </nav>
          </div>
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Monetization Disclosure</h5>
            <div className="p-3 rounded-xl border border-white/5 bg-white/5">
              <span className="text-[8px] font-black opacity-30 uppercase">Ad Space Placeholder</span>
              <p className="text-[9px] opacity-40 font-medium">Labeled according to FTC guidelines. This application is funded via non-targeted advertisements.</p>
            </div>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-4 py-2 px-6 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/20 border border-white/5 text-white/40">
          <span>© 2024 SkyCast Neural</span>
          <button onClick={() => { setLegalTab('terms'); setShowLegal(true); }} className="hover:text-blue-500 focus:outline-none">Legal & Privacy Hub</button>
        </div>
      </footer>

      {/* Expanded Compliance: Legal & Privacy Hub Modal */}
      {showLegal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLegal(false)}></div>
          <div className={`relative w-full max-w-4xl glass-card rounded-[2.5rem] shadow-2xl h-[80vh] flex flex-col md:flex-row overflow-hidden ${theme === 'midnight' ? 'bg-black border-white/10' : 'bg-slate-900 border-white/5'}`}>
            {/* Sidebar Navigation for the Hub */}
            <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col gap-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-shield-check"></i> Compliance Hub
              </h2>
              {[
                { id: 'privacy', label: 'Privacy & GDPR', icon: 'fa-user-shield' },
                { id: 'terms', label: 'Terms of Service', icon: 'fa-file-contract' },
                { id: 'security', label: 'Security Protocols', icon: 'fa-lock' },
                { id: 'ip', label: 'IP & Licenses', icon: 'fa-copyright' },
                { id: 'data', label: 'Manage My Data', icon: 'fa-user-gear' },
              ].map((tab) => (
                <button 
                  key={tab.id} 
                  onClick={() => setLegalTab(tab.id as any)}
                  className={`text-[9px] font-black uppercase tracking-widest text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${legalTab === tab.id ? 'bg-blue-500 text-white shadow-lg' : 'opacity-40 hover:bg-white/5 hover:opacity-100'}`}
                >
                  <i className={`fa-solid ${tab.icon} w-4 text-center`}></i> {tab.label}
                </button>
              ))}
              <div className="mt-auto pt-6 border-t border-white/5">
                <p className="text-[8px] opacity-30 font-black uppercase">Version 1.0.4-Sync</p>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col">
               <div className="flex-1 overflow-y-auto p-8 pr-12 no-scrollbar text-sm opacity-80 leading-relaxed space-y-8">
                {legalTab === 'privacy' && (
                  <>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Privacy & Data Shield</h3><p>Compliance with GDPR (EU), CCPA (California), and COPPA is fundamental to our architecture. We operate on a data-minimization principle.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Cookie & Collection Disclosure</h3><p>We do not use tracking cookies. Local device storage is used strictly for theme syncing and atmospheric cache persistence. We never sell personal information.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">User Rights</h3><p>You have the right to access, rectify, or delete your data at any time via the "Manage My Data" tab in this hub.</p></section>
                  </>
                )}
                {legalTab === 'terms' && (
                  <>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Terms of Use</h3><p>By accessing SkyCast AI, you agree to these binding terms. This service is provided for informational purposes only.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Limitation of Liability</h3><p>Atmospheric models are probabilistic. SkyCast is not responsible for any property damage, personal injury, or loss of life resulting from decisions made based on forecast telemetry.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Usage Policy</h3><p>Automated scraping or reverse engineering of the SkyCast neural link is strictly prohibited.</p></section>
                  </>
                )}
                {legalTab === 'security' && (
                  <>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Security Architecture</h3><p>All data transmissions are encrypted using industrial-grade HTTPS (TLS 1.3). API keys are managed server-side and are never exposed to the client-side telemetry stream.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Data Protection</h3><p>User preferences are stored locally in the browser's sandbox. No sensitive personal identifiers are stored on SkyCast infrastructure.</p></section>
                  </>
                )}
                {legalTab === 'ip' && (
                  <>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Intellectual Property</h3><p>The SkyCast AI interface, design system, and proprietary AI analysis logic are protected under international copyright law.</p></section>
                    <section><h3 className="text-xs font-black text-blue-500 uppercase mb-3">Licenses & Attributions</h3><p>Weather data is sourced via Creative Commons 4.0 (Open-Meteo). Icons provided by FontAwesome Free License. Mapping services by BigDataCloud.</p></section>
                  </>
                )}
                {legalTab === 'data' && (
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-blue-500 uppercase">Personal Data Sovereignty</h3>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-black mb-4 opacity-40 uppercase tracking-widest">Active Cache Report:</p>
                      <ul className="text-[11px] space-y-3 font-medium">
                        <li className="flex justify-between"><span>Interface Theme</span> <span className="opacity-40">{theme}</span></li>
                        <li className="flex justify-between"><span>Thermal Unit</span> <span className="opacity-40">Celsius ({unit})</span></li>
                        <li className="flex justify-between"><span>Primary Coordinate Anchor</span> <span className="opacity-40">{defaultLocation?.name || 'Dynamic Only'}</span></li>
                      </ul>
                    </div>
                    <button onClick={deleteUserData} className="w-full py-5 rounded-2xl bg-rose-600 text-white font-black uppercase text-[10px] hover:bg-rose-500 transition-all shadow-xl shadow-rose-600/10">Purge My Entire Device Profile</button>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-white/10">
                <button onClick={() => setShowLegal(false)} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] shadow-xl shadow-blue-600/20">Close Compliance Hub</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compliance: Consent Banner */}
      {showConsent && (
        <div className="fixed bottom-6 left-6 right-6 z-[300] sm:max-w-md">
          <div className="glass-card p-6 rounded-3xl border-blue-500/20 shadow-2xl bg-slate-900/90 flex flex-col gap-4 border">
             <div className="flex items-center gap-3">
               <i className="fa-solid fa-cookie-bite text-2xl text-amber-500"></i>
               <h4 className="text-[10px] font-black uppercase tracking-widest">Atmospheric Consent Required</h4>
             </div>
             <p className="text-[11px] opacity-70 leading-relaxed">SkyCast uses local storage to sync your theme and weather telemetry. No personal data is sold. By continuing, you agree to our <button onClick={() => { setLegalTab('privacy'); setShowLegal(true); }} className="text-blue-400 underline">Privacy Policy</button>.</p>
             <div className="flex gap-2">
               <button onClick={acceptConsent} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-[9px] hover:bg-blue-500 transition-all">I Agree</button>
               <button onClick={() => setShowConsent(false)} className="px-4 py-3 rounded-xl bg-white/5 font-black uppercase text-[9px]">Later</button>
             </div>
          </div>
        </div>
      )}

      {/* Compliance: Location Transparency */}
      {showLocationExplain && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowLocationExplain(false)}></div>
          <div className="relative w-full max-w-sm glass-card p-8 rounded-[2.5rem] bg-slate-900 shadow-2xl text-center border border-white/5">
            <i className="fa-solid fa-location-dot text-4xl text-blue-500 mb-6 drop-shadow-lg"></i>
            <h4 className="text-sm font-black uppercase tracking-widest mb-4">Precision Telemetry</h4>
            <p className="text-xs opacity-60 leading-relaxed mb-8">Accessing your GPS allows SkyCast to provide micro-climate data. Your coordinates are transmitted securely via HTTPS and never stored on our servers.</p>
            <div className="flex flex-col gap-3">
              <button onClick={requestGeolocation} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] shadow-lg shadow-blue-600/20">Allow Precision Sync</button>
              <button onClick={() => setShowLocationExplain(false)} className="w-full py-4 rounded-2xl bg-white/5 font-black uppercase text-[10px]">Manual Search</button>
            </div>
          </div>
        </div>
      )}

      <Analytics />
    </div>
  );
};

export default App;