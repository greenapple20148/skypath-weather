
import { WeatherData, GeocodingResult } from '../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const AQI_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const fetchWeather = async (lat: number, lon: number, locationName: string, country: string): Promise<WeatherData> => {
  const weatherParams = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,uv_index',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '7'
  });

  const aqiParams = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: 'us_aqi',
  });

  const [weatherRes, aqiRes] = await Promise.all([
    fetch(`${BASE_URL}?${weatherParams.toString()}`),
    fetch(`${AQI_URL}?${aqiParams.toString()}`)
  ]);

  if (!weatherRes.ok) throw new Error('Failed to fetch weather data');
  const weatherData = await weatherRes.json();
  
  let aqiValue = 0;
  if (aqiRes.ok) {
    const aqiData = await aqiRes.json();
    aqiValue = aqiData.current?.us_aqi || 0;
  }

  return {
    current: {
      temp: weatherData.current.temperature_2m,
      weatherCode: weatherData.current.weather_code,
      isDay: weatherData.current.is_day === 1,
      windSpeed: weatherData.current.wind_speed_10m,
      humidity: weatherData.current.relative_humidity_2m,
      uvIndex: weatherData.current.uv_index,
      apparentTemp: weatherData.current.apparent_temperature,
      aqi: aqiValue,
    },
    hourly: {
      time: weatherData.hourly.time.slice(0, 24),
      temperature: weatherData.hourly.temperature_2m.slice(0, 24),
      precipitation: weatherData.hourly.precipitation_probability.slice(0, 24),
      weatherCode: weatherData.hourly.weather_code.slice(0, 24),
    },
    daily: {
      time: weatherData.daily.time,
      tempMax: weatherData.daily.temperature_2m_max,
      tempMin: weatherData.daily.temperature_2m_min,
      weatherCode: weatherData.daily.weather_code,
    },
    location: {
      name: locationName,
      country: country,
      latitude: lat,
      longitude: lon,
    }
  };
};

export const searchLocation = async (query: string): Promise<GeocodingResult[]> => {
  if (query.length < 2) return [];
  const response = await fetch(`${GEO_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
  const data = await response.json();
  if (!data.results) return [];
  
  return data.results.map((item: any) => ({
    name: item.name,
    country: item.country,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
};

export const reverseGeocode = async (lat: number, lon: number): Promise<{ name: string; country: string }> => {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const data = await response.json();
    return {
      name: data.city || data.locality || 'Unknown Location',
      country: data.countryName || ''
    };
  } catch {
    return { name: 'Current Location', country: '' };
  }
};

export const getWeatherDescription = (code: number): { text: string; icon: string; bg: string; image: string } => {
  const codes: Record<number, { text: string; icon: string; bg: string; image: string }> = {
    0: { text: 'Clear Sky', icon: 'fa-sun', bg: 'from-cyan-400 via-blue-500 to-indigo-600', image: 'sunny' },
    1: { text: 'Mainly Clear', icon: 'fa-cloud-sun', bg: 'from-sky-400 via-blue-500 to-blue-700', image: 'clear-sky' },
    2: { text: 'Partly Cloudy', icon: 'fa-cloud-sun', bg: 'from-blue-300 via-sky-400 to-indigo-500', image: 'partly-cloudy' },
    3: { text: 'Overcast', icon: 'fa-cloud', bg: 'from-slate-400 via-gray-500 to-slate-600', image: 'overcast' },
    45: { text: 'Fog', icon: 'fa-smog', bg: 'from-slate-500 via-zinc-600 to-slate-700', image: 'foggy' },
    48: { text: 'Depositing Rime Fog', icon: 'fa-smog', bg: 'from-zinc-500 via-gray-600 to-zinc-700', image: 'foggy' },
    51: { text: 'Light Drizzle', icon: 'fa-cloud-rain', bg: 'from-blue-500 via-indigo-600 to-violet-700', image: 'drizzle' },
    61: { text: 'Slight Rain', icon: 'fa-cloud-showers-heavy', bg: 'from-blue-700 via-indigo-800 to-slate-900', image: 'rainy' },
    71: { text: 'Slight Snow', icon: 'fa-snowflake', bg: 'from-blue-50 via-sky-100 to-indigo-200', image: 'snowy' },
    95: { text: 'Thunderstorm', icon: 'fa-bolt', bg: 'from-gray-800 via-slate-900 to-black', image: 'thunderstorm' },
  };

  let result;
  if (code >= 51 && code <= 55) result = codes[51];
  else if (code >= 61 && code <= 65) result = codes[61];
  else if (code >= 80 && code <= 82) result = codes[61];
  else if (code >= 71 && code <= 75) result = codes[71];
  else if (code >= 95) result = codes[95];
  else result = codes[code];

  return result || { text: 'Unknown', icon: 'fa-question', bg: 'from-slate-600 via-gray-700 to-slate-800', image: 'weather' };
};
