
export interface WeatherData {
  current: {
    temp: number;
    weatherCode: number;
    isDay: boolean;
    windSpeed: number;
    humidity: number;
    uvIndex: number;
    apparentTemp: number;
    aqi: number;
  };
  hourly: {
    time: string[];
    temperature: number[];
    precipitation: number[];
    weatherCode: number[];
  };
  daily: {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    weatherCode: number[];
  };
  location: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  };
}

export interface GeocodingResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}
