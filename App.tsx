
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { fetchWeather, searchLocation, reverseGeocode, getWeatherDescription } from './services/weatherService';
import { getAIInsight, fetchWeatherNews, fetchNearbyRestaurants, fetchNearbyMalls, fetchNearbyTheatres, fetchMoviesNearby, fetchHistoryOnThisDay } from './services/geminiService';
import { WeatherData, GeocodingResult, NewsItem, Place, Movie, HistoryEvent } from './types';
import { WeatherIconLarge } from './components/WeatherIcons';

type Theme = 'light' | 'dark' | 'midnight';
type ExploreCategory = 'Dining' | 'Shopping' | 'Cinema';

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
  
  const [activeExplore, setActiveExplore] = useState<ExploreCategory>('Dining');
  const [nearbyDining, setNearbyDining] = useState<{ text: string, places: Place[] }>({ text: '', places: [] });
  const [nearbyMalls, setNearbyMalls] = useState<{ text: string, places: Place[] }>({ text: '', places: [] });
  const [nearbyTheatres, setNearbyTheatres] = useState<{ text: string, places: Place[] }>({ text: '', places: [] });
  const [movies, setMovies] = useState<Movie[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  
  const [isDiningLoading, setIsDiningLoading] = useState(false);
  const [isMallsLoading, setIsMallsLoading] = useState(false);
  const [isTheatresLoading, setIsTheatresLoading] = useState(false);
  const [isMoviesLoading, setIsMoviesLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark' || saved === 'midnight') return saved;
    return 'midnight';
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

  const updateNews = async (location: string) => {
    setIsNewsLoading(true);
    const newsData = await fetchWeatherNews(location);
    setNews(newsData);
    setIsNewsLoading(false);
  };

  const updateExploreData = async (lat: number, lon: number) => {
    setIsDiningLoading(true);
    setIsMallsLoading(true);
    setIsTheatresLoading(true);
    setIsMoviesLoading(true);
    setIsHistoryLoading(true);
    
    const [dining, malls, theatres, movieList, history] = await Promise.all([
      fetchNearbyRestaurants(lat, lon),
      fetchNearbyMalls(lat, lon),
      fetchNearbyTheatres(lat, lon),
      fetchMoviesNearby(lat, lon),
      fetchHistoryOnThisDay()
    ]);

    setNearbyDining(dining);
    setNearbyMalls(malls);
    setNearbyTheatres(theatres);
    setMovies(movieList);
    setHistoryEvents(history);
    
    setIsDiningLoading(false);
    setIsMallsLoading(false);
    setIsTheatresLoading(false);
    setIsMoviesLoading(false);
    setIsHistoryLoading(false);
  };

  const loadWeather = useCallback(async (lat: number, lon: number, name: string, country: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon, name, country);
      setWeather(data);
      updateAiInsight(data);
      updateNews(name);
      updateExploreData(lat, lon);
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
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const info = await reverseGeocode(latitude, longitude);
        loadWeather(latitude, longitude, info.name, info.country);
      },
      () => {
        setError('Location permission denied.');
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
    return { label: 'Warning', color: 'text-rose-400', bg: 'bg-rose-500/10' };
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

  const currentExplore = (() => {
    switch(activeExplore) {
      case 'Shopping': return { data: nearbyMalls, loading: isMallsLoading, icon: 'fa-bag-shopping', color: 'text-emerald-500', bg: 'bg-emerald-500/20' };
      case 'Cinema': return { data: nearbyTheatres, loading: isTheatresLoading || isMoviesLoading, icon: 'fa-film', color: 'text-rose-500', bg: 'bg-rose-500/20' };
      default: return { data: nearbyDining, loading: isDiningLoading, icon: 'fa-utensils', color: 'text-orange-500', bg: 'bg-orange-500/20' };
    }
  })();

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
            <div className="relative flex-1 sm:w-80 group">
              <i className={`fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 ${!isLight ? 'text-white/30' : 'text-slate-400'}`}></i>
              <input
                type="text"
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
            </div>
            
            <button onClick={cycleTheme} className={`p-2.5 rounded-xl shadow-xl active:scale-90 ${!isLight ? 'bg-white/10 text-amber-400 border border-white/10' : 'bg-white text-indigo-600 border border-slate-200'}`}>
              <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : (theme === 'dark' ? 'fa-moon' : 'fa-circle-half-stroke')} text-lg`}></i>
            </button>
          </div>
        </header>

        {weather && (
          <main className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <section className="lg:col-span-8 space-y-5">
              <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row justify-between items-center relative z-10 gap-6">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${!isLight ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'} text-[8px] font-black uppercase tracking-widest border`}>
                      <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative h-2 w-2 rounded-full bg-blue-500"></span></span>
                      Ground Sync Active
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">{weather.location.name}</h2>
                    <p className="text-sm font-medium opacity-50 uppercase tracking-[0.3em]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                    <div className="pt-4 flex items-center gap-4">
                      <span className="text-7xl md:text-9xl font-black tracking-tighter leading-none">{formatTemp(weather.current.temp)}°</span>
                      <button onClick={toggleUnit} className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border h-fit shadow-lg active:scale-95 ${!isLight ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                        <span className={`text-[10px] font-black ${unit === 'C' ? 'text-blue-500' : 'opacity-40'}`}>C</span>
                        <div className={`w-8 h-4 rounded-full relative ${!isLight ? 'bg-white/10' : 'bg-slate-200'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-blue-500 transition-all duration-300 shadow-sm`} style={{ left: unit === 'F' ? '18px' : '2px' }} />
                        </div>
                        <span className={`text-[10px] font-black ${unit === 'F' ? 'text-blue-500' : 'opacity-40'}`}>F</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <WeatherIconLarge code={weather.current.weatherCode} className="text-8xl md:text-9xl mb-4 drop-shadow-2xl animate-float" />
                    <p className="text-3xl font-black uppercase tracking-tighter">{desc?.text}</p>
                    <p className="text-xs opacity-50 font-bold uppercase tracking-widest mt-1">Feels like {formatTemp(weather.current.apparentTemp)}°</p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[2rem] p-6 shadow-xl">
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
              </div>

              <div className="glass-card rounded-[2rem] p-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isLight ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-600 text-white'}`}><i className="fa-solid fa-compass text-sm"></i></div>
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-50">Explore Nearby</h3>
                  </div>
                  <div className={`flex p-1 rounded-2xl border ${!isLight ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                    {(['Dining', 'Shopping', 'Cinema'] as ExploreCategory[]).map((cat) => (
                      <button key={cat} onClick={() => setActiveExplore(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeExplore === cat ? (isLight ? 'bg-white text-indigo-600 shadow-md' : 'bg-indigo-500 text-white') : 'opacity-40 hover:opacity-100'}`}>{cat}</button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {currentExplore.loading ? (
                      <div className="space-y-3"><div className="h-3 w-full bg-current opacity-10 rounded-full animate-pulse"></div><div className="h-3 w-4/5 bg-current opacity-10 rounded-full animate-pulse"></div></div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${currentExplore.bg} ${currentExplore.color} shadow-xl`}><i className={`fa-solid ${currentExplore.icon} text-xl`}></i></div>
                        <p className="text-sm font-medium leading-relaxed opacity-80 italic">{currentExplore.data.text}</p>
                        
                        {activeExplore === 'Cinema' && movies.length > 0 && (
                          <div className="mt-6 space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 flex items-center gap-2">
                              <i className="fa-solid fa-clapperboard"></i> Now Playing
                            </h4>
                            <div className="space-y-3">
                              {movies.map((movie, idx) => (
                                <div key={idx} className={`p-4 rounded-2xl border transition-all duration-300 ${!isLight ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                  <h5 className="text-xs font-black mb-1">{movie.title}</h5>
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {movie.theaters.map((t, i) => (
                                      <span key={i} className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">{t}</span>
                                    ))}
                                  </div>
                                  <p className="text-[10px] opacity-60 leading-tight">{movie.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-30 mb-1">Top Locations</p>
                    {currentExplore.loading ? [1,2,3].map(i => <div key={i} className="h-12 w-full bg-current opacity-5 rounded-xl animate-pulse"></div>) : currentExplore.data.places.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {currentExplore.data.places.map((place, idx) => (
                          <a key={idx} href={place.uri} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group ${!isLight ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-50 shadow-sm hover:shadow-md'}`}>
                            <span className="text-xs font-black truncate">{place.title}</span>
                            <i className={`fa-solid fa-arrow-up-right-from-square text-[10px] ${currentExplore.color}`}></i>
                          </a>
                        ))}
                      </div>
                    ) : <div className="py-8 text-center opacity-30 text-[10px] font-black uppercase">No units detected nearby</div>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card rounded-3xl p-6 shadow-xl flex flex-col max-h-[400px]">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 opacity-50"><div className="w-1 h-4 bg-amber-500 rounded-full"></div> Regional Intelligence</h3>
                  <div className="space-y-3 overflow-y-auto pr-2 no-scrollbar">
                    {isNewsLoading ? [1,2].map(i => <div key={i} className="h-20 w-full bg-current opacity-5 rounded-xl animate-pulse"></div>) : news.map((item, idx) => (
                      <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className={`block p-4 rounded-xl border transition-all duration-300 ${!isLight ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-50 shadow-sm'}`}>
                        <p className="text-[8px] font-black uppercase text-blue-400 mb-1">{item.source}</p>
                        <h4 className="text-xs font-bold leading-tight line-clamp-2">{item.title}</h4>
                      </a>
                    ))}
                  </div>
                </div>
                <div className={`ai-glow backdrop-blur-3xl rounded-3xl p-6 shadow-xl flex flex-col ${isMidnight ? 'bg-black/60' : (isLight ? 'bg-white' : 'bg-white/5 border border-white/10')}`}>
                   <div className="flex items-center gap-3 mb-4"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isLight ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-600 text-white'}`}><i className="fa-solid fa-sparkles text-sm animate-pulse"></i></div><span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-50">AI Neural Forecast</span></div>
                   <div className="flex-1">{isAiLoading ? <div className="h-3 w-full bg-current opacity-10 rounded-full animate-pulse"></div> : <p className="text-sm font-medium leading-relaxed italic opacity-80">{aiInsight}</p>}</div>
                </div>
              </div>
            </section>

            <aside className="lg:col-span-4 space-y-5 h-full">
              {/* Extended Forecast Card */}
              <div className="glass-card rounded-[2rem] p-6 shadow-2xl">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-40 mb-8 flex items-center justify-between"><span>Extended Window</span><i className="fa-solid fa-calendar-days text-[10px]"></i></h3>
                <div className="space-y-3">
                  {weather.daily.time.map((day, idx) => {
                    const date = new Date(day);
                    const dayDesc = getWeatherDescription(weather.daily.weatherCode[idx]);
                    return (
                      <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border border-transparent ${!isLight ? 'hover:bg-white/5' : 'hover:bg-blue-50'}`}>
                        <div className="w-16"><p className="text-xs font-black">{idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}</p><p className="text-[8px] font-bold opacity-30">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p></div>
                        <i className={`fa-solid ${dayDesc.icon} text-2xl flex-1 text-center ${dayDesc.icon.includes('sun') ? 'text-amber-400' : 'text-blue-500'} drop-shadow-xl`}></i>
                        <div className="flex gap-4 text-right">
                          <div className="w-10"><span className="text-sm font-black block">{formatTemp(weather.daily.tempMax[idx])}°</span><span className="text-[8px] opacity-30 font-bold uppercase block">High</span></div>
                          <div className="w-10 opacity-60"><span className="text-sm font-black block">{formatTemp(weather.daily.tempMin[idx])}°</span><span className="text-[8px] opacity-30 font-bold uppercase block">Low</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Historical Archive Card */}
              <div className="glass-card rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
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
              </div>
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
    </div>
  );
};

export default App;
