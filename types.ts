
export interface WeatherData {
  current: {
    temp: number;
    weatherCode: number;
    isDay: boolean;
    windSpeed: number;
    windDirection: number;
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

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
}

export interface Place {
  title: string;
  uri: string;
  imageUrl?: string;
}

export interface Movie {
  title: string;
  theaters: string[];
  description?: string;
}

export interface HistoryEvent {
  year: string;
  title: string;
  description: string;
}

export interface SavedLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export type ImageSize = "1K" | "2K" | "4K";

export interface ImageGenerationConfig {
  prompt: string;
  size: ImageSize;
}
