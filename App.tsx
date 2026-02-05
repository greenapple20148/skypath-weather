import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { fetchWeather, searchLocation, reverseGeocode, getWeatherDescription } from './services/weatherService';
import { getAIInsight, fetchHistoryOnThisDay, fetchDailyQuote } from './services/geminiService';
import { WeatherData, GeocodingResult, HistoryEvent, SavedLocation } from './types';
import { WeatherIconLarge } from './components/WeatherIcons';
import { Analytics } from "@vercel/analytics/next"


type Theme = 'light' | 'dark' | 'midnight';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [dailyQuote, setDailyQuote] = useState<{ text: string, author: string } | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Settings State
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

  // SEO: Dynamic Metadata Update
  useEffect(() => {
    if (weather) {
      const locationName = weather.location.name;
      const desc = getWeatherDescription(weather.current.weatherCode);
      const temp = formatTemp(weather.current.temp);
      
      document.title = `SkyCast AI | ${locationName} Weather - ${temp}°${unit} & ${desc.text}`;
      
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', `Current weather in ${locationName}: ${temp}°${unit}, ${desc.text}. Get AI-powered insights and historical records for ${locationName}.`);
      }

      const scriptTag = document.getElementById('structured-data');
      if (scriptTag) {
        const structuredData = {
          "@context": "https://schema.org",
          "@type": "WeatherForecast",
          "name": `Weather in ${locationName}`,
          "description": `${desc.text} forecast for ${locationName}`,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": locationName,
            "addressCountry": weather.location.country
          },
          "temperature": `${temp} ${unit}`,
          "forecast": weather.daily.time.map((time, i) => ({
            "@type": "DayOfWeek",
            "datePublished": time,
            "temperatureMax": formatTemp(weather.daily.tempMax[i]),
            "temperatureMin": formatTemp(weather.daily.tempMin[i])
          }))
        };
        scriptTag.innerHTML = JSON.stringify(structuredData);
      }
    } else {
      document.title = "SkyCast AI | Hyper-Local Weather Intelligence";
    }
  }, [weather, unit]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'midnight');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tempUnit', unit);
    if (weather) {
      updateAiInsight(weather);
    }
  }, [unit, weather]);

  const cycleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'midnight';
      return 'light';
    });
  };

  const formatTemp = (celsius: number) => {
    const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
    return Math.round(value);
  };

  const toggleUnit = () => {
    setUnit(prev => prev === 'C' ? 'F' : 'C');
  };

  const updateAiInsight = async (data: WeatherData) => {
    setIsAiLoading(true);
    const insight = await getAIInsight(data); 
    setAiInsight(insight);
    setIsAiLoading(false);
  };

  const updateDailyQuote = async (descText: string) => {
    setIsQuoteLoading(true);
    const quote = await fetchDailyQuote(descText);
    setDailyQuote(quote);
    setIsQuoteLoading(false);
  };

  const loadWeather = useCallback(async (lat: number, lon: number, name: string, country: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon, name, country);
      setWeather(data);
      const descInfo = getWeatherDescription(data.current.weatherCode);
      
      updateAiInsight(data);
      updateDailyQuote(descInfo.text);
      
      setIsHistoryLoading(true);
      const history = await fetchHistoryOnThisDay();
      setHistoryEvents(history);
      setIsHistoryLoading(false);
    } catch (err) {
      setError('Could not fetch weather data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const info = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, info.name, info.country);
      },
      () => {
        if (defaultLocation) {
          loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.name, defaultLocation.country);
        } else {
          setError('Location permission denied. Search for a city above.');
          setLoading(false);
        }
      }
    );
  };

  useEffect(() => {
    if (defaultLocation) {
      loadWeather(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.name, defaultLocation.country);
    } else {
      handleGeolocation();
    }
  }, []);

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
    loadWeather(loc.latitude, loc.longitude, loc.name, loc.country);
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
    loadWeather(loc.latitude, loc.longitude, loc.name, loc.country);
    setShowSettings(false);
  };

  const handleClearDefault = () => {
    setDefaultLocation(null);
    localStorage.removeItem('defaultLocation');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const getUvRiskLevel = (uv: number) => {
    if (uv <= 2) return { level: 'Low', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (uv <= 5) return { level: 'Moderate', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
    if (uv <= 7) return { level: 'High', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    if (uv <= 10) return { level: 'Very High', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    return { level: 'Extreme', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' };
  };

  if (loading && !weather) {
    const loaderBg = theme === 'midnight' ? 'bg-black' : (theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50');
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${loaderBg} text-blue-500 transition-colors duration-1000`}>
        <div className="w-16 h-16 border-4 border-blue-500/10 rounded-full relative">
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 font-black tracking-widest uppercase text-[10px] animate-pulse">Syncing Atmosphere</p>
      </div>
    );
  }

  const desc = weather ? getWeatherDescription(weather.current.weatherCode) : null;
  const isLight = theme === 'light';
  const isMidnight = theme === 'midnight';
  const atmosphericGradient = desc?.bg || 'from-slate-900 to-black';

  const chartData = weather ? weather.hourly.time.map((time, i) => ({
    time: new Date(time).getHours() + ":00",
    temp: formatTemp(weather.hourly.temperature[i]),
    precip: weather.hourly.precipitation[i],
    code: weather.hourly.weatherCode[i],
    displayTime: new Date(time).toLocaleTimeString('en-US', { hour: 'numeric' })
  })) : [];

  const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className={`min-h-screen relative overflow-hidden transition-all duration-1000 ${isLight ? 'text-slate-900' : 'text-white'} p-3 md:p-6`}>
      <div className={`absolute inset-0 bg-black transition-opacity duration-1000 pointer-events-none z-0 ${isMidnight ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-0 bg-[#f8fafc] transition-opacity duration-1000 pointer-events-none z-0 ${isLight ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${atmosphericGradient} transition-opacity duration-1000 pointer-events-none z-0`} style={{ opacity: theme === 'dark' ? 1 : 0 }} />

      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleGeolocation}>
            <div className={`${!isLight ? 'bg-white/10' : 'bg-blue-600'} p-2 rounded-xl backdrop-blur-xl shadow-xl transition-all duration-1000 group-hover:scale-110`}>
              <i className="fa-solid fa-wind text-xl text-white"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black leading-none tracking-tighter">SkyCast</h1>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-50">AI Neural Link</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <nav className="relative flex-1 sm:w-80 group">
              <i className={`fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 ${!isLight ? 'text-white/30' : 'text-slate-400'}`}></i>
              <input
                type="text"
                aria-label="Search weather by location"
                className={`w-full rounded-2xl py-2.5 pl-12 pr-6 focus:outline-none ${!isLight ? 'bg-white/5 border border-white/10 text-white focus:bg-white/10' : 'bg-white border border-slate-200 text-slate-900 shadow-lg focus:border-blue-500'}`}
                placeholder="Query atmosphere..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchResults.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-2xl ${!isLight ? 'glass-card' : 'bg-white border border-slate-100'}`}>
                  {searchResults.map((res, idx) => (
                    <button key={idx} onClick={() => handleSelectLocation(res)} className={`w-full text-left px-5 py-3 border-b last:border-0 flex flex-col hover:bg-white/10 ${!isLight ? 'border-white/5' : 'border-slate-50'}`}>
                      <span className="font-bold text-sm">{res.name}</span>
                      <span className="text-[8px] uppercase tracking-widest opacity-50">{res.country}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
            
            <div className="flex items-center gap-2">
              <button aria-label="Cycle theme" onClick={cycleTheme} className={`p-2.5 rounded-xl shadow-xl active:scale-90 ${!isLight ? 'bg-white/10 text-amber-400 border border-white/10' : 'bg-white text-indigo-600 border border-slate-200'}`}>
                <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : (theme === 'dark' ? 'fa-moon' : 'fa-circle-half-stroke')} text-lg`}></i>
              </button>
              
              <div className="relative">
                <button aria-label="Settings" onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-xl shadow-xl active:scale-90 ${!isLight ? 'bg-white/10 text-blue-400 border border-white/10' : 'bg-white text-blue-600 border border-slate-200'}`}>
                  <i className="fa-solid fa-gear text-lg"></i>
                </button>
                
                {showSettings && (
                  <div ref={settingsRef} className={`absolute top-full right-0 mt-4 w-72 md:w-80 rounded-[2rem] p-6 z-[100] shadow-2xl transition-all duration-300 transform scale-100 origin-top-right ${!isLight ? 'glass-card' : 'bg-white border border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-xs font-black uppercase tracking-widest opacity-50">System Config</h4>
                      <button onClick={() => setShowSettings(false)} className="opacity-50 hover:opacity-100 transition-opacity"><i className="fa-solid fa-times"></i></button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Home Anchor</label>
                        <div className="relative">
                          <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 opacity-30"></i>
                          <input
                            type="text"
                            placeholder="Set default city..."
                            className={`w-full rounded-xl py-2.5 pl-10 pr-4 text-xs focus:outline-none border ${!isLight ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                            value={settingsSearch}
                            onChange={handleSettingsSearchChange}
                          />
                          {settingsResults.length > 0 && (
                            <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-[110] shadow-2xl border ${!isLight ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                              {settingsResults.map((res, idx) => (
                                <button key={idx} onClick={() => handleSetDefaultLocation(res)} className={`w-full text-left px-4 py-2 border-b last:border-0 hover:bg-blue-500/10 transition-colors ${!isLight ? 'border-white/5' : 'border-slate-50'}`}>
                                  <div className="font-bold text-[10px]">{res.name}</div>
                                  <div className="text-[8px] opacity-40 uppercase">{res.country}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {defaultLocation && (
                          <div className={`flex items-center justify-between p-3 rounded-xl border ${!isLight ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-500 truncate">{defaultLocation.name}</span>
                              <span className="text-[8px] font-bold opacity-40 uppercase">{defaultLocation.country}</span>
                            </div>
                            <button onClick={handleClearDefault} className="text-rose-500 hover:text-rose-600 transition-colors p-1"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Thermal Scale</span>
                          <button onClick={toggleUnit} className={`px-3 py-1.5 rounded-lg font-black text-[10px] transition-all ${!isLight ? 'bg-white/10 hover:bg-white/20' : 'bg-slate-100 hover:bg-slate-200'}`}>
                            {unit === 'C' ? 'CELSIUS' : 'FAHRENHEIT'}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Atmospheric Sync</span>
                          <button onClick={handleGeolocation} className={`px-3 py-1.5 rounded-lg font-black text-[10px] text-blue-500 border border-blue-500/20 transition-all ${!isLight ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'bg-blue-50 hover:bg-blue-100'}`}>
                            FORCE SYNC
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {weather && (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <section className="lg:col-span-8 space-y-5">
              <article className="glass-card rounded-[2rem] p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${!isLight ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'} text-[8px] font-black uppercase tracking-widest border`}>
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative h-2 w-2 rounded-full bg-blue-500"></span></span>
                      Ground Sync Active
                    </div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{weather.location.name}</h2>
                      {defaultLocation?.name === weather.location.name && (
                        <i className="fa-solid fa-house-chimney text-blue-500 text-sm md:text-xl drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"></i>
                      )}
                    </div>
                    <p className="text-sm font-medium opacity-50 uppercase tracking-[0.3em]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    <div className="pt-4 flex items-center gap-4">
                      <span className="text-7xl md:text-9xl font-black tracking-tighter leading-none">{formatTemp(weather.current.temp)}°</span>
                      <div className="flex flex-col gap-2">
                         <button aria-label="Toggle Temperature Unit" onClick={toggleUnit} className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border h-fit shadow-lg active:scale-95 ${!isLight ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                          <span className={`text-[10px] font-black ${unit === 'C' ? 'text-blue-500' : 'opacity-40'}`}>C</span>
                          <div className={`w-8 h-4 rounded-full relative ${!isLight ? 'bg-white/10' : 'bg-slate-200'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-blue-500 transition-all duration-300 shadow-sm`} style={{ left: unit === 'F' ? '18px' : '2px' }} />
                          </div>
                          <span className={`text-[10px] font-black ${unit === 'F' ? 'text-blue-500' : 'opacity-40'}`}>F</span>
                        </button>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 opacity-50">
                             <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center relative overflow-hidden">
                                <i className="fa-solid fa-arrow-up text-[8px]" style={{ transform: `rotate(${weather.current.windDirection}deg)` }}></i>
                             </div>
                             <span className="text-[9px] font-black uppercase tracking-widest">{weather.current.windSpeed} km/h</span>
                          </div>
                          {(() => {
                            const risk = getUvRiskLevel(weather.current.uvIndex);
                            return (
                              <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border h-6 ${risk.bg} ${risk.border}`}>
                                 <i className={`fa-solid fa-sun text-[9px] ${risk.color}`}></i>
                                 <span className={`text-[9px] font-black uppercase tracking-widest ${risk.color}`}>UV {weather.current.uvIndex} • {risk.level}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <WeatherIconLarge code={weather.current.weatherCode} className="text-8xl md:text-9xl mb-4 drop-shadow-2xl animate-float" />
                    <p className="text-3xl font-black uppercase tracking-tighter">{desc?.text}</p>
                    <p className="text-xs opacity-50 font-bold uppercase tracking-widest mt-1">Feels like {formatTemp(weather.current.apparentTemp)}°</p>
                  </div>
                </div>
              </article>

              <section aria-label="Hourly Forecast Chart" className="glass-card rounded-[2rem] p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 opacity-50">
                    <div className="w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div> Atmospheric Delta
                  </h3>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={!isLight ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} />
                      <XAxis dataKey="time" stroke={!isLight ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"} fontSize={8} fontWeight={900} tickLine={false} axisLine={false} interval={3} />
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const hourDesc = getWeatherDescription(data.code);
                          return (
                            <div className={`p-4 rounded-3xl border backdrop-blur-2xl shadow-2xl flex flex-col gap-3 min-w-[200px] ${!isLight ? 'bg-black/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">{data.displayTime}</span>
                                <div className="flex items-center gap-1.5 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                  <i className={`fa-solid ${hourDesc.icon} text-[10px] text-blue-400`}></i>
                                  <span className="text-[9px] font-black uppercase text-blue-400">{hourDesc.text}</span>
                                </div>
                              </div>
                              <span className={`text-4xl font-black ${!isLight ? 'text-white' : 'text-slate-900'}`}>{data.temp}°</span>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold opacity-60">Precipitation</span>
                                <span className="text-[10px] font-black text-blue-500">{data.precip}%</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Area type="monotone" dataKey="temp" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" animationDuration={1500} activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <section aria-label="AI Weather Analysis" className={`ai-glow backdrop-blur-3xl rounded-3xl p-8 shadow-xl flex flex-col ${isMidnight ? 'bg-black/60' : (isLight ? 'bg-white' : 'bg-white/5 border border-white/10')}`}>
                   <div className="flex items-center gap-3 mb-6">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!isLight ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-600 text-white'}`}>
                        <i className="fa-solid fa-sparkles text-lg animate-pulse"></i>
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 block">Atmospheric Processor</span>
                        <h3 className="text-xs font-black uppercase tracking-widest">AI Neural Analysis</h3>
                      </div>
                   </div>
                   <div className="flex-1">
                     {isAiLoading ? (
                       <div className="space-y-3">
                         <div className="h-3 w-full bg-current opacity-10 rounded-full animate-pulse"></div>
                         <div className="h-3 w-4/5 bg-current opacity-10 rounded-full animate-pulse"></div>
                       </div>
                     ) : (
                       <p className="text-base font-medium leading-relaxed italic opacity-80">{aiInsight}</p>
                     )}
                   </div>
                </section>

                <section aria-label="Atmospheric Wisdom" className={`glass-card rounded-3xl p-8 shadow-xl flex flex-col relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150"><i className="fa-solid fa-feather-pointed text-6xl"></i></div>
                  <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!isLight ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500 text-white'}`}>
                      <i className="fa-solid fa-quote-left text-lg"></i>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 block">Daily Inspiration</span>
                      <h3 className="text-xs font-black uppercase tracking-widest">Zen Window</h3>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-center relative z-10">
                    {isQuoteLoading ? (
                       <div className="space-y-3">
                         <div className="h-4 w-full bg-current opacity-10 rounded-full animate-pulse"></div>
                         <div className="h-4 w-3/4 bg-current opacity-10 rounded-full animate-pulse"></div>
                       </div>
                    ) : dailyQuote ? (
                      <div className="space-y-4">
                        <p className="text-xl md:text-2xl font-serif italic font-medium leading-tight line-clamp-4">"{dailyQuote.text}"</p>
                        <div className="flex items-center gap-2">
                           <div className="w-4 h-[1px] bg-current opacity-30"></div>
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60">— {dailyQuote.author}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm opacity-30 italic">Syncing with the cosmos...</p>
                    )}
                  </div>
                  <div className="mt-6 flex items-center gap-2 opacity-20 relative z-10">
                    <i className="fa-solid fa-rotate text-[8px]"></i>
                    <span className="text-[8px] font-black uppercase tracking-widest">Cycle Sync: {todayStr}</span>
                  </div>
                </section>
              </div>
            </section>

            <aside className="lg:col-span-4 space-y-5 h-full">
              <section aria-label="7-Day Extended Forecast" className="glass-card rounded-[2rem] p-6 h-full shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 mb-8 flex items-center justify-between"><span>Extended Window</span><i className="fa-solid fa-calendar-days text-[10px]"></i></h3>
                <div className="space-y-3">
                  {weather.daily.time.map((day, idx) => {
                    const date = new Date(day);
                    const dayDesc = getWeatherDescription(weather.daily.weatherCode[idx]);
                    
                    const getTrendIcon = (curr: number, prev: number) => {
                      if (curr > prev) return <i className="fa-solid fa-caret-up text-emerald-500 ml-1"></i>;
                      if (curr < prev) return <i className="fa-solid fa-caret-down text-rose-500 ml-1"></i>;
                      return null;
                    };

                    const maxTrend = idx > 0 ? getTrendIcon(weather.daily.tempMax[idx], weather.daily.tempMax[idx - 1]) : null;
                    const minTrend = idx > 0 ? getTrendIcon(weather.daily.tempMin[idx], weather.daily.tempMin[idx - 1]) : null;

                    return (
                      <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border border-transparent group ${!isLight ? 'hover:bg-white/5' : 'hover:bg-blue-50'}`}>
                        <div className="w-20 sm:w-24">
                          <p className="text-xs font-black">{idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                             <i className={`fa-solid ${dayDesc.icon} text-[9px] ${dayDesc.icon.includes('sun') ? 'text-amber-400' : 'text-blue-500'}`}></i>
                             <span className="text-[9px] font-bold opacity-40 uppercase tracking-tight truncate max-w-[60px]">{dayDesc.text}</span>
                          </div>
                        </div>
                        <div className="flex-1 flex justify-center items-center relative">
                           <div className={`absolute w-12 h-12 rounded-full blur-xl opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-r ${dayDesc.bg}`}></div>
                           <i className={`fa-solid ${dayDesc.icon} text-2xl relative z-10 ${dayDesc.icon.includes('sun') ? 'text-amber-400' : 'text-blue-500'} ${dayDesc.animate} drop-shadow-xl`}></i>
                        </div>
                        <div className="flex gap-4 text-right items-center">
                          <div className="w-12">
                            <div className="flex items-center justify-end">
                              <span className="text-sm font-black">{formatTemp(weather.daily.tempMax[idx])}°</span>
                              {maxTrend}
                            </div>
                            <span className="text-[8px] opacity-30 font-bold uppercase block">High</span>
                          </div>
                          <div className="w-12 opacity-60">
                            <div className="flex items-center justify-end">
                              <span className="text-sm font-black">{formatTemp(weather.daily.tempMin[idx])}°</span>
                              {minTrend}
                            </div>
                            <span className="text-[8px] opacity-30 font-bold uppercase block">Low</span>
                          </div>
                          <div className={`w-1.5 h-1.5 rounded-full ml-1 ${dayDesc.bg.split(' ')[0].replace('from-', 'bg-')}`}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section aria-label="On This Day History" className="glass-card rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150"><i className="fa-solid fa-timeline text-6xl"></i></div>
                <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 mb-6 flex items-center justify-between relative z-10">
                  <span>Temporal Records</span>
                  <i className="fa-solid fa-clock-rotate-left text-[10px]"></i>
                </h3>
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">History Link:</span>
                    <span className="text-[10px] font-bold opacity-50 uppercase">{todayStr}</span>
                  </div>
                  
                  {isHistoryLoading ? (
                    [1,2,3].map(i => <div key={i} className="space-y-2"><div className="h-3 w-12 bg-current opacity-10 rounded-full animate-pulse"></div><div className="h-3 w-full bg-current opacity-10 rounded-full animate-pulse"></div></div>)
                  ) : historyEvents.length > 0 ? (
                    <div className="space-y-6 border-l border-white/10 ml-1.5 pl-4">
                      {historyEvents.map((event, idx) => (
                        <div key={idx} className="relative group">
                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] group-hover:scale-150 transition-all duration-300"></div>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-blue-500 block leading-none">{event.year}</span>
                            <h4 className="text-xs font-black leading-tight group-hover:text-blue-400 transition-colors duration-300">{event.title}</h4>
                            <p className="text-[10px] opacity-60 leading-relaxed line-clamp-2">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] opacity-30 text-center py-4 border border-dashed rounded-xl">No temporal records found</p>
                  )}
                </div>
              </section>
            </aside>
          </main>
        )}
      </div>
      
      <footer className="max-w-7xl mx-auto mt-12 mb-6 text-center">
        <div className={`inline-flex items-center gap-4 py-2 px-6 rounded-full text-[8px] font-black uppercase tracking-widest border ${!isLight ? 'bg-black/20 border-white/5 text-white/20' : 'bg-white border-slate-100 text-slate-400'}`}>
          <span>© 2024 SkyCast Neural</span>
          <div className="h-2 w-[1px] bg-current opacity-20"></div>
          <span>Satellite Ver. 4.10.2</span>
        </div>
      </footer>
      <Analytics></Analytics>
    </div>
  );
};

export default App;