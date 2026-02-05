
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { fetchWeather, searchLocation, reverseGeocode, getWeatherDescription } from './services/weatherService';
import { getAIInsight, fetchWeatherNews } from './services/geminiService';
import { WeatherData, GeocodingResult, NewsItem } from './types';
import { WeatherIconLarge } from './components/WeatherIcons';

type Theme = 'light' | 'dark' | 'midnight';

const App: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'midnight') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [unit, setUnit] = useState<'C' | 'F'>(() => {
    return (localStorage.getItem('tempUnit') as 'C' | 'F') || 'C';
  });

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
  }, [unit]);

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

  const updateAiInsight = async (data: WeatherData) => {
    setIsAiLoading(true);
    const insight = await getAIInsight(data); 
    setAiInsight(insight);
    setIsAiLoading(false);
  };

  const updateNews = async (location: string) => {
    setIsNewsLoading(true);
    const newsData = await fetchWeatherNews(location);
    setNews(newsData);
    setIsNewsLoading(false);
  };

  const loadWeather = useCallback(async (lat: number, lon: number, name: string, country: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon, name, country);
      setWeather(data);
      updateAiInsight(data);
      updateNews(name);
    } catch (err) {
      setError('Could not fetch weather data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const info = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, info.name, info.country);
      },
      () => {
        setError('Permission denied. Please search for a city.');
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    handleGeolocation();
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

  const getAQIInfo = (aqi: number) => {
    if (aqi <= 50) return { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (aqi <= 100) return { label: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    if (aqi <= 150) return { label: 'Sensitive', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (aqi <= 200) return { label: 'Unhealthy', color: 'text-rose-400', bg: 'bg-rose-500/10' };
    if (aqi <= 300) return { label: 'Severe', color: 'text-purple-400', bg: 'bg-purple-500/10' };
    return { label: 'Hazardous', color: 'text-rose-900', bg: 'bg-rose-900/10' };
  };

  if (loading && !weather) {
    const loaderBg = theme === 'midnight' ? 'bg-black' : (theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50');
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${loaderBg} text-blue-500`}>
        <div className="relative">
          <div className="w-24 h-24 border-8 border-blue-500/10 rounded-full"></div>
          <div className="absolute top-0 left-0 w-24 h-24 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-8 font-black tracking-[0.5em] uppercase text-[10px] animate-pulse">Syncing Atmosphere</p>
      </div>
    );
  }

  const desc = weather ? getWeatherDescription(weather.current.weatherCode) : null;
  const isLight = theme === 'light';
  const isMidnight = theme === 'midnight';
  const weatherImageUrl = desc ? `https://images.unsplash.com/photo-1592210454359-9043f067919b?q=80&w=1920&auto=format&fit=crop&keyword=${desc.image}` : '';

  const mainBg = isMidnight 
    ? 'bg-black' 
    : (isLight ? 'bg-[#f8fafc]' : `bg-gradient-to-br ${desc?.bg || 'from-slate-900 to-black'}`);

  return (
    <div className={`min-h-screen transition-all duration-1000 relative overflow-hidden ${mainBg} ${isLight ? 'text-slate-900' : 'text-white'} p-4 md:p-8`}>
      {weather && (
        <div 
          className="absolute inset-0 opacity-[0.12] pointer-events-none transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url('${weatherImageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            mixBlendMode: isLight ? 'multiply' : 'screen',
            filter: isMidnight ? 'grayscale(1) brightness(0.5)' : 'none'
          }}
        />
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col lg:flex-row justify-between items-center mb-12 gap-8">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={handleGeolocation}>
            <div className={`${!isLight ? 'bg-white/10' : 'bg-blue-600'} p-3.5 rounded-[1.25rem] backdrop-blur-xl transition-all duration-700 shadow-2xl group-hover:rotate-12`}>
              <i className="fa-solid fa-wind text-3xl text-white"></i>
            </div>
            <div>
              <h1 className={`text-4xl font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'} leading-none`}>SkyCast</h1>
              <span className={`text-[10px] font-black tracking-[0.4em] uppercase opacity-50 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>Advanced Intelligence</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full lg:w-auto">
            <div className="relative w-full sm:w-96 group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <i className={`fa-solid fa-magnifying-glass ${!isLight ? 'text-white/30' : 'text-slate-400'}`}></i>
              </div>
              <input
                type="text"
                className={`w-full rounded-[1.5rem] py-4 pl-14 pr-7 focus:outline-none focus:ring-4 focus:ring-blue-500/20 backdrop-blur-xl transition-all ${
                  !isLight 
                  ? 'bg-white/5 border border-white/10 placeholder:text-white/20 text-white' 
                  : 'bg-white border border-slate-200 placeholder:text-slate-400 text-slate-900 shadow-xl'
                }`}
                placeholder="Find location..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              
              {searchResults.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-3 rounded-[1.5rem] overflow-hidden z-50 shadow-2xl ${!isLight ? 'glass-card' : 'bg-white border border-slate-100'}`}>
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectLocation(res)}
                      className={`w-full text-left px-6 py-4.5 border-b last:border-0 flex items-center justify-between transition-all ${
                        !isLight 
                        ? 'hover:bg-white/10 border-white/5 text-white' 
                        : 'hover:bg-blue-50 border-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">{res.name}</span>
                        <span className={`text-[10px] uppercase tracking-widest opacity-50 font-black`}>{res.country}</span>
                      </div>
                      <i className="fa-solid fa-chevron-right text-[10px] opacity-30"></i>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`flex p-1.5 rounded-2xl transition-colors ${!isLight ? 'bg-white/5 border border-white/10' : 'bg-slate-200 border border-slate-300 shadow-inner'}`}>
                {['C', 'F'].map((u) => (
                  <button 
                    key={u}
                    onClick={() => setUnit(u as 'C' | 'F')}
                    className={`px-5 py-2 rounded-[0.8rem] text-xs font-black transition-all ${unit === u ? (!isLight ? 'bg-white/20 text-white shadow-xl' : 'bg-white text-blue-600 shadow-lg') : (!isLight ? 'text-white/30 hover:text-white/50' : 'text-slate-500 hover:text-slate-700')}`}
                  >
                    °{u}
                  </button>
                ))}
              </div>

              <button 
                onClick={cycleTheme}
                className={`p-4 rounded-2xl transition-all active:scale-95 shadow-2xl flex items-center gap-3 ${
                  !isLight 
                  ? 'bg-white/10 hover:bg-white/20 text-amber-400 border border-white/10' 
                  : 'bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200'
                }`}
                title={`Theme: ${theme}`}
              >
                <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : (theme === 'dark' ? 'fa-moon' : 'fa-circle-half-stroke')} text-xl`}></i>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{theme}</span>
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[1.5rem] mb-10 flex items-center gap-5 animate-in slide-in-from-top duration-700">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 shadow-lg">
              <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            </div>
            <div>
              <p className="font-black uppercase text-[10px] tracking-widest text-rose-500 mb-1">Network Error</p>
              <span className={!isLight ? 'text-rose-100' : 'text-rose-800'}>{error}</span>
            </div>
          </div>
        )}

        {weather && (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <section className="lg:col-span-8 space-y-10">
              <div className="glass-card rounded-[3rem] p-12 relative overflow-hidden group">
                <div className={`absolute -top-32 -right-32 w-[30rem] h-[30rem] rounded-full blur-[120px] transition-all duration-1000 ${!isLight ? 'bg-blue-600/20 opacity-40' : 'bg-blue-400/30 opacity-60'}`}></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start relative z-10">
                  <div className="space-y-6">
                    <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full ${!isLight ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'} text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm`}>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                      </span>
                      Satellite Sync Active
                    </div>
                    <h2 className={`text-7xl font-black ${!isLight ? 'text-white' : 'text-slate-900'} tracking-tighter leading-none`}>{weather.location.name}</h2>
                    <p className="text-2xl font-medium opacity-50">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    
                    <div className="pt-12 flex items-baseline gap-6 group/temp">
                      <span className={`text-[11rem] font-black leading-none tracking-tighter ${!isLight ? 'text-white' : 'text-slate-900'} group-hover/temp:scale-105 transition-transform duration-700`}>{formatTemp(weather.current.temp)}°</span>
                      <span className="text-5xl font-light opacity-30">{unit}</span>
                    </div>
                  </div>
                  
                  <div className="mt-16 md:mt-0 flex flex-col items-center md:items-end">
                    <WeatherIconLarge code={weather.current.weatherCode} className="text-[14rem] mb-10 drop-shadow-[0_30px_60px_rgba(59,130,246,0.4)] hover:scale-110 transition-transform duration-1000" />
                    <div className="text-center md:text-right">
                      <p className={`text-5xl font-black mb-2 ${!isLight ? 'text-white' : 'text-slate-800'}`}>{desc?.text}</p>
                      <p className="text-xl opacity-40 font-bold uppercase tracking-[0.2em]">Feels like {formatTemp(weather.current.apparentTemp)}°</p>
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-5 gap-10 mt-20 pt-12 border-t ${!isLight ? 'border-white/5' : 'border-slate-100'}`}>
                  {[
                    { label: 'Humidity', value: `${weather.current.humidity}%`, icon: 'fa-droplets', color: 'text-blue-400 bg-blue-500/10' },
                    { label: 'Wind', value: `${weather.current.windSpeed} km/h`, icon: 'fa-wind', color: 'text-sky-400 bg-sky-500/10' },
                    { label: 'UV Global', value: Math.round(weather.current.uvIndex), icon: 'fa-sun-bright', color: 'text-amber-400 bg-amber-500/10' },
                    { label: 'Rain', value: `${Math.max(...weather.hourly.precipitation)}%`, icon: 'fa-cloud-rain', color: 'text-indigo-400 bg-indigo-500/10' },
                    { label: 'AQI Index', value: weather.current.aqi, icon: 'fa-lungs', aqi: true }
                  ].map((item, i) => {
                    const aqiInfo = item.aqi ? getAQIInfo(weather.current.aqi) : null;
                    const visualClass = item.aqi ? `${aqiInfo?.bg} ${aqiInfo?.color}` : item.color;
                    
                    return (
                      <div key={i} className="flex flex-col items-center md:items-start gap-5 group/stat">
                        <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-2xl transition-all duration-500 group-hover/stat:scale-110 group-hover/stat:-rotate-12 ${visualClass}`}>
                          <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div className="text-center md:text-left">
                          <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-30 mb-2">{item.label}</p>
                          <p className={`text-2xl font-black ${!isLight ? 'text-white' : 'text-slate-800'}`}>
                            {item.value} 
                            {item.aqi && <span className={`text-[11px] block mt-1 font-black uppercase tracking-widest ${aqiInfo?.color} opacity-80`}>{aqiInfo?.label}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hourly Timeline */}
              <div className="glass-card rounded-[2.5rem] p-10 shadow-3xl">
                <div className="flex justify-between items-end mb-10">
                  <h3 className={`text-3xl font-black flex items-center gap-4 ${!isLight ? 'text-white' : 'text-slate-800'}`}>
                    <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                    Timeline
                  </h3>
                </div>
                <div className="flex overflow-x-auto gap-6 pb-8 no-scrollbar snap-x">
                  {weather.hourly.time.map((time, idx) => {
                    const hour = new Date(time).getHours();
                    const iconDesc = getWeatherDescription(weather.hourly.weatherCode[idx]);
                    const isNow = idx === 0;
                    return (
                      <div key={idx} className={`flex-shrink-0 w-36 p-8 rounded-[2.5rem] flex flex-col items-center gap-5 transition-all duration-700 snap-center border-2 ${
                        isNow 
                        ? (isMidnight ? 'bg-blue-600/20 border-blue-500/40 shadow-[0_0_50px_rgba(59,130,246,0.3)] scale-110' : (isLight ? 'bg-blue-600 border-blue-600 text-white shadow-2xl scale-110' : 'bg-blue-600/20 border-blue-500 shadow-2xl scale-110')) 
                        : (!isLight ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl')
                      }`}>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isNow ? (isLight ? 'text-blue-100' : 'text-blue-400') : (isLight ? 'text-slate-400' : 'text-white/30')}`}>
                          {isNow ? 'LIVE' : `${hour}:00`}
                        </span>
                        <i className={`fa-solid ${iconDesc.icon} text-4xl ${isNow && isLight ? 'text-white' : (iconDesc.icon.includes('sun') ? 'text-amber-400' : 'text-blue-400')} drop-shadow-lg`}></i>
                        <span className="text-3xl font-black">
                          {formatTemp(weather.hourly.temperature[idx])}°
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weather News Section */}
              <div className="glass-card rounded-[2.5rem] p-10 shadow-3xl">
                <div className="flex justify-between items-center mb-10">
                  <h3 className={`text-3xl font-black flex items-center gap-4 ${!isLight ? 'text-white' : 'text-slate-800'}`}>
                    <div className="w-2 h-8 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                    Meteorological Reports
                  </h3>
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border animate-pulse ${!isLight ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                    Live Grounding
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {isNewsLoading ? (
                    [1, 2, 3, 4].map((i) => (
                      <div key={i} className={`p-6 rounded-[2rem] border animate-pulse ${!isLight ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="h-4 w-3/4 bg-current opacity-10 rounded-full mb-4"></div>
                        <div className="h-3 w-full bg-current opacity-10 rounded-full mb-2"></div>
                        <div className="h-3 w-1/2 bg-current opacity-10 rounded-full"></div>
                      </div>
                    ))
                  ) : news.length > 0 ? (
                    news.map((item, idx) => (
                      <a 
                        key={idx} 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`group p-6 rounded-[2rem] border transition-all duration-500 hover:scale-[1.02] ${
                          !isLight 
                          ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/30' 
                          : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${!isLight ? 'text-blue-400' : 'text-blue-600'}`}>
                            {item.source}
                          </span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-20 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all"></i>
                        </div>
                        <h4 className={`text-lg font-black leading-tight mb-2 group-hover:text-blue-500 transition-colors ${!isLight ? 'text-white' : 'text-slate-800'}`}>
                          {item.title}
                        </h4>
                        <p className={`text-sm opacity-50 font-medium line-clamp-2`}>
                          {item.snippet}
                        </p>
                      </a>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center opacity-30">
                      <i className="fa-solid fa-newspaper text-5xl mb-4 block"></i>
                      <p className="font-bold tracking-widest uppercase text-xs">No active news bulletins for this region</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Neural Insight */}
              <div className={`ai-glow backdrop-blur-[40px] rounded-[3rem] p-12 shadow-3xl transition-all duration-1000 overflow-hidden ${
                isMidnight ? 'bg-black/80' : (isLight ? 'bg-white border border-slate-200' : 'bg-white/5 border border-white/10')
              }`}>
                <div className="relative z-10">
                  <div className="flex flex-col md:flex-row gap-10 items-start md:items-center mb-10">
                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center flex-shrink-0 shadow-2xl ${!isLight ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-600 text-white'}`}>
                      <i className="fa-solid fa-sparkles text-3xl animate-pulse"></i>
                    </div>
                    <div>
                      <h4 className={`text-[11px] font-black uppercase tracking-[0.5em] mb-2 ${!isLight ? 'text-blue-400' : 'text-blue-600'}`}>Meteorological Analysis</h4>
                      <p className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'} tracking-tight`}>AI Context Generator</p>
                    </div>
                  </div>
                  <div className="min-h-[100px]">
                    {isAiLoading ? (
                      <div className="space-y-5 pt-4">
                        <div className={`h-5 w-full rounded-full animate-pulse ${!isLight ? 'bg-white/10' : 'bg-slate-100'}`}></div>
                        <div className={`h-5 w-11/12 rounded-full animate-pulse ${!isLight ? 'bg-white/10' : 'bg-slate-100'}`}></div>
                      </div>
                    ) : (
                      <p className={`text-2xl leading-relaxed font-semibold ${!isLight ? 'text-blue-50' : 'text-slate-700'}`}>
                        {aiInsight}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <aside className="lg:col-span-4 space-y-10">
              <div className="glass-card rounded-[3rem] p-12 h-full shadow-3xl sticky top-10">
                <div className="flex justify-between items-center mb-12">
                  <h3 className={`text-3xl font-black ${isLight ? 'text-slate-800' : 'text-white'} tracking-tight`}>7-Day Forecast</h3>
                </div>
                <div className="space-y-8">
                  {weather.daily.time.map((day, idx) => {
                    const date = new Date(day);
                    const dayName = idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' });
                    const dayDesc = getWeatherDescription(weather.daily.weatherCode[idx]);
                    return (
                      <div key={idx} className={`group flex items-center justify-between p-6 rounded-[2.5rem] transition-all duration-700 border border-transparent ${
                        !isLight ? 'hover:bg-white/5 hover:border-white/10' : 'hover:bg-blue-50/50 hover:border-blue-100'
                      }`}>
                        <div className="flex-1">
                          <p className={`text-xl font-black ${!isLight ? 'text-white' : 'text-slate-800'}`}>{dayName}</p>
                          <p className="text-xs font-black uppercase tracking-widest opacity-30">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <i className={`fa-solid ${dayDesc.icon} text-4xl ${dayDesc.icon.includes('sun') ? 'text-amber-400' : 'text-blue-500'} drop-shadow-xl`}></i>
                        </div>
                        <div className="flex gap-8 justify-end flex-1">
                          <div className="text-right">
                            <span className={`text-2xl font-black block leading-none ${isLight ? 'text-slate-800' : 'text-white'}`}>{formatTemp(weather.daily.tempMax[idx])}°</span>
                            <span className="text-[10px] font-black uppercase opacity-20">Peak</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </main>
        )}
      </div>
    </div>
  );
};

export default App;
