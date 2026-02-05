
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { fetchWeather, searchLocation, reverseGeocode, getWeatherDescription } from './services/weatherService';
import { getAIInsight } from './services/geminiService';
import { WeatherData, GeocodingResult } from './types';
import { WeatherIconLarge } from './components/WeatherIcons';

const App: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  const [unit, setUnit] = useState<'C' | 'F'>(() => {
    return (localStorage.getItem('tempUnit') as 'C' | 'F') || 'C';
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tempUnit', unit);
    if (weather) {
      updateAiInsight(weather);
    }
  }, [unit]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

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

  const loadWeather = useCallback(async (lat: number, lon: number, name: string, country: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(lat, lon, name, country);
      setWeather(data);
      updateAiInsight(data);
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
    if (aqi <= 50) return { label: 'Good', color: 'text-green-500', bg: 'bg-green-500/20' };
    if (aqi <= 100) return { label: 'Moderate', color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    if (aqi <= 150) return { label: 'Unhealthy (S)', color: 'text-orange-500', bg: 'bg-orange-500/20' };
    if (aqi <= 200) return { label: 'Unhealthy', color: 'text-red-500', bg: 'bg-red-500/20' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: 'text-purple-500', bg: 'bg-purple-500/20' };
    return { label: 'Hazardous', color: 'text-rose-900', bg: 'bg-rose-900/20' };
  };

  if (loading && !weather) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-blue-500 font-medium">Scanning the skies...</p>
      </div>
    );
  }

  const desc = weather ? getWeatherDescription(weather.current.weatherCode) : null;
  const chartData = weather ? weather.hourly.time.map((time, i) => ({
    time: new Date(time).getHours() + ":00",
    temp: formatTemp(weather.hourly.temperature[i]),
    precip: weather.hourly.precipitation[i]
  })) : [];

  const isDark = theme === 'dark';

  // Dynamic Background Image
  const weatherImageUrl = desc ? `https://images.unsplash.com/photo-1592210454359-9043f067919b?q=80&w=1920&auto=format&fit=crop&keyword=${desc.image}` : '';

  return (
    <div className={`min-h-screen transition-all duration-1000 relative overflow-hidden ${isDark ? `bg-gradient-to-br ${desc?.bg || 'from-slate-800 to-slate-900'} text-white` : 'bg-slate-50 text-slate-800'} p-4 md:p-8`}>
      {/* Background Hero Image */}
      {weather && (
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-1000"
          style={{ 
            backgroundImage: `url('${weatherImageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: isDark ? 'grayscale(0.5) brightness(0.5)' : 'none'
          }}
        />
      )}

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className={`${isDark ? 'bg-white/20' : 'bg-blue-600'} p-2 rounded-xl backdrop-blur-md transition-colors shadow-lg`}>
              <i className="fa-solid fa-wind text-2xl text-white"></i>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight ${!isDark && 'text-slate-900'}`}>SkyCast AI</h1>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-96 group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <i className={`fa-solid fa-magnifying-glass ${isDark ? 'text-white/50' : 'text-slate-400'}`}></i>
              </div>
              <input
                type="text"
                className={`w-full border rounded-full py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-400/50 backdrop-blur-md transition-all ${
                  isDark 
                  ? 'bg-white/10 border-white/20 placeholder:text-white/40 text-white' 
                  : 'bg-white border-slate-200 placeholder:text-slate-400 text-slate-900 shadow-sm'
                }`}
                placeholder="Search for a city..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              
              {searchResults.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50 shadow-xl ${isDark ? 'glass-card' : 'bg-white border border-slate-200'}`}>
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectLocation(res)}
                      className={`w-full text-left px-4 py-3 border-b last:border-0 flex items-center justify-between transition-colors ${
                        isDark 
                        ? 'hover:bg-white/10 border-white/5 text-white' 
                        : 'hover:bg-slate-50 border-slate-100 text-slate-700'
                      }`}
                    >
                      <span>{res.name}, <span className={`${isDark ? 'text-white/60' : 'text-slate-400'} text-sm`}>{res.country}</span></span>
                      <i className={`fa-solid fa-chevron-right text-xs ${isDark ? 'text-white/30' : 'text-slate-300'}`}></i>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`flex p-1 rounded-full border transition-colors ${isDark ? 'bg-white/10 border-white/10' : 'bg-slate-200 border-slate-300'}`}>
                <button 
                  onClick={() => setUnit('C')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${unit === 'C' ? (isDark ? 'bg-white/20 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (isDark ? 'text-white/40 hover:text-white/60' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  °C
                </button>
                <button 
                  onClick={() => setUnit('F')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${unit === 'F' ? (isDark ? 'bg-white/20 text-white shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (isDark ? 'text-white/40 hover:text-white/60' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  °F
                </button>
              </div>

              <button 
                onClick={toggleTheme}
                className={`p-3 rounded-full transition-all active:scale-95 ${
                  isDark 
                  ? 'bg-white/10 hover:bg-white/20 text-yellow-400' 
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                }`}
                title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              >
                <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'} text-xl`}></i>
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <i className="fa-solid fa-triangle-exclamation text-red-500"></i>
            <span className={isDark ? 'text-white' : 'text-red-700'}>{error}</span>
          </div>
        )}

        {weather && (
          <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 space-y-6">
              {/* Current Weather Summary Card */}
              <div className="glass-card rounded-3xl p-8 relative overflow-hidden group shadow-xl">
                <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full blur-3xl transition-colors duration-500 ${isDark ? 'bg-white/5 group-hover:bg-white/10' : 'bg-blue-100 group-hover:bg-blue-200'}`}></div>
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative">
                  <div>
                    <h2 className={`text-5xl font-bold mb-2 ${!isDark && 'text-slate-900'}`}>{weather.location.name}</h2>
                    <p className={`${isDark ? 'text-white/70' : 'text-slate-500'} text-lg`}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    <div className="mt-8 flex items-baseline gap-2">
                      <span className={`text-8xl font-black tracking-tighter ${!isDark && 'text-slate-900'}`}>{formatTemp(weather.current.temp)}°</span>
                      <span className={`text-2xl font-medium ${isDark ? 'text-white/60' : 'text-slate-400'}`}>{unit}</span>
                    </div>
                  </div>
                  
                  <div className="mt-8 md:mt-0 flex flex-col items-center">
                    <WeatherIconLarge code={weather.current.weatherCode} className="text-9xl mb-4 drop-shadow-2xl" />
                    <p className={`text-2xl font-semibold ${!isDark && 'text-slate-800'}`}>{desc?.text}</p>
                    <p className={isDark ? 'text-white/60' : 'text-slate-400'}>Feels like {formatTemp(weather.current.apparentTemp)}°</p>
                  </div>
                </div>

                <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-12 pt-8 border-t ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                  {[
                    { label: 'Humidity', value: `${weather.current.humidity}%`, icon: 'fa-droplet', color: 'bg-blue-500/20 text-blue-500' },
                    { label: 'Wind', value: `${weather.current.windSpeed} km/h`, icon: 'fa-wind', color: 'bg-orange-500/20 text-orange-500' },
                    { label: 'UV Index', value: Math.round(weather.current.uvIndex), icon: 'fa-sun', color: 'bg-yellow-500/20 text-yellow-600' },
                    { label: 'Precip.', value: `${Math.max(...weather.hourly.precipitation)}%`, icon: 'fa-umbrella', color: 'bg-indigo-500/20 text-indigo-500' },
                    { label: 'AQI (US)', value: weather.current.aqi, icon: 'fa-lungs', aqi: true }
                  ].map((item, i) => {
                    const aqiInfo = item.aqi ? getAQIInfo(weather.current.aqi) : null;
                    const colorClass = item.aqi ? `${aqiInfo?.bg} ${aqiInfo?.color}` : item.color;
                    
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                          <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div>
                          <p className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-white/50' : 'text-slate-400'}`}>{item.label}</p>
                          <p className={`font-semibold ${!isDark && 'text-slate-700'}`}>
                            {item.value} {item.aqi && <span className="text-[10px] opacity-70 block -mt-1">{aqiInfo?.label}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hourly Forecast Carousel */}
              <div className="glass-card rounded-3xl p-6 shadow-lg">
                <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${!isDark && 'text-slate-800'}`}>
                  <i className="fa-solid fa-hourglass-half text-blue-500"></i>
                  Hourly Forecast
                </h3>
                <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar scroll-smooth">
                  {weather.hourly.time.map((time, idx) => {
                    const hour = new Date(time).getHours();
                    const iconDesc = getWeatherDescription(weather.hourly.weatherCode[idx]);
                    return (
                      <div key={idx} className={`flex-shrink-0 w-24 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all hover:scale-105 border ${
                        isDark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
                      }`}>
                        <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-slate-400'}`}>
                          {idx === 0 ? 'Now' : `${hour}:00`}
                        </span>
                        <i className={`fa-solid ${iconDesc.icon} text-2xl ${iconDesc.icon.includes('sun') ? 'text-yellow-500' : 'text-blue-400'}`}></i>
                        <span className={`text-lg font-bold ${!isDark && 'text-slate-800'}`}>
                          {formatTemp(weather.hourly.temperature[idx])}°
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                           <i className="fa-solid fa-droplet scale-75"></i>
                           {weather.hourly.precipitation[idx]}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Insight Card */}
              <div className={`backdrop-blur-md border rounded-3xl p-6 relative overflow-hidden shadow-xl transition-colors ${
                isDark 
                ? 'bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border-white/20' 
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-slate-200'
              }`}>
                <div className="absolute top-2 right-4">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                    isDark ? 'bg-white/10 text-white/80 border-white/10' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'
                  }`}>AI INSIGHT</div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isDark ? 'bg-white/20' : 'bg-blue-600'
                  }`}>
                    <i className={`fa-solid fa-wand-magic-sparkles text-xl ${isDark ? 'text-blue-200' : 'text-white'}`}></i>
                  </div>
                  <div className="flex-1 min-h-[60px]">
                    {isAiLoading ? (
                      <div className="space-y-2 mt-1">
                        <div className={`h-3 w-3/4 rounded animate-pulse ${isDark ? 'bg-white/20' : 'bg-slate-200'}`}></div>
                        <div className={`h-3 w-1/2 rounded animate-pulse ${isDark ? 'bg-white/20' : 'bg-slate-200'}`}></div>
                      </div>
                    ) : (
                      <p className={`text-lg leading-relaxed ${isDark ? 'text-blue-50' : 'text-slate-700'}`}>
                        {aiInsight}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Graphs Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-3xl p-6 shadow-lg">
                  <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${!isDark && 'text-slate-800'}`}>
                    <i className="fa-solid fa-temperature-half text-blue-500"></i>
                    Temp Trend (°{unit})
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={isDark ? 0.8 : 0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis 
                          dataKey="time" 
                          stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={4}
                        />
                        <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', 
                            borderRadius: '12px', 
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                            color: isDark ? '#fff' : '#1e293b',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: '#3b82f6' }}
                          formatter={(value) => [`${value}°${unit}`, 'Temp']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="temp" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorTemp)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card rounded-3xl p-6 shadow-lg">
                  <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${!isDark && 'text-slate-800'}`}>
                    <i className="fa-solid fa-cloud-rain text-indigo-500"></i>
                    Rain Probability %
                  </h3>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                        <XAxis 
                          dataKey="time" 
                          stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={4}
                        />
                        <YAxis hide domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)', 
                            borderRadius: '12px', 
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                            color: isDark ? '#fff' : '#1e293b',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                          itemStyle={{ color: '#6366f1' }}
                          formatter={(value) => [`${value}%`, 'Chance']}
                        />
                        <Bar dataKey="precip" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.precip > 50 ? '#6366f1' : '#818cf8'} fillOpacity={isDark ? 0.8 : 0.6} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </section>

            {/* Sidebar Forecast */}
            <aside className="space-y-6">
              <div className="glass-card rounded-3xl p-6 h-full shadow-lg">
                <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${!isDark && 'text-slate-800'}`}>
                  <i className="fa-regular fa-calendar text-blue-500"></i>
                  7-Day Forecast
                </h3>
                <div className="space-y-4">
                  {weather.daily.time.map((day, idx) => {
                    const date = new Date(day);
                    const dayName = idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayDesc = getWeatherDescription(weather.daily.weatherCode[idx]);
                    
                    return (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-2xl transition-colors border border-transparent group ${
                        isDark ? 'hover:bg-white/5 hover:border-white/10' : 'hover:bg-slate-50 hover:border-slate-100'
                      }`}>
                        <div className="flex-1">
                          <p className={`font-semibold ${isDark ? 'text-white/90' : 'text-slate-700'}`}>{dayName}</p>
                          <p className={`text-xs ${isDark ? 'text-white/50' : 'text-slate-400'}`}>{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <div className="flex flex-col items-center flex-1">
                          <i className={`fa-solid ${dayDesc.icon} text-xl ${dayDesc.icon.includes('sun') ? 'text-yellow-500' : 'text-blue-400'}`}></i>
                        </div>
                        <div className="flex gap-4 justify-end flex-1">
                          <span className={`font-bold ${!isDark && 'text-slate-800'}`}>{formatTemp(weather.daily.tempMax[idx])}°</span>
                          <span className={isDark ? 'text-white/40' : 'text-slate-400'}>{formatTemp(weather.daily.tempMin[idx])}°</span>
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
      
      <footer className={`max-w-6xl mx-auto mt-12 mb-8 text-center text-sm relative z-10 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
        <p>© 2024 SkyCast AI. Powered by Google Gemini & Open-Meteo. Images from Unsplash.</p>
      </footer>
    </div>
  );
};

export default App;
