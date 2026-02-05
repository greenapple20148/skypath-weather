
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, NewsItem, Place, Movie, HistoryEvent } from "../types";

export const getAIInsight = async (weather: WeatherData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const unit = localStorage.getItem('tempUnit') || 'C';
  const convert = (c: number) => unit === 'F' ? Math.round((c * 9) / 5 + 32) : Math.round(c);

  const prompt = `
    Context: Weather data for ${weather.location.name}, ${weather.location.country}.
    User Preferred Unit: °${unit}
    Current Temperature: ${convert(weather.current.temp)}°${unit}
    Feels Like: ${convert(weather.current.apparentTemp)}°${unit}
    Condition Code: ${weather.current.weatherCode}
    
    Task: Provide a concise (2-3 sentences), helpful weather insight. 
    Mention temperatures in °${unit}. 
    Mention what to wear or plan for the day based on this weather. 
    Keep it professional but warm. Use emoji sparingly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });
    
    return response.text || "No AI insight available at the moment.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The AI weather specialist is currently taking a coffee break. Dress comfortably!";
  }
};

export const fetchWeatherNews = async (location: string): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Find the top 3-4 most recent and relevant weather news stories or environmental updates specifically for ${location} or surrounding areas.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const news: NewsItem[] = [];
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (grounding && Array.isArray(grounding)) {
      grounding.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          news.push({
            title: chunk.web.title || 'Local Weather Update',
            snippet: 'Latest update on local conditions and environment.',
            url: chunk.web.uri,
            source: new URL(chunk.web.uri).hostname.replace('www.', ''),
            date: 'Live'
          });
        }
      });
    }
    return news.slice(0, 4);
  } catch (error) {
    console.error("News Fetch Error:", error);
    return [];
  }
};

export const fetchHistoryOnThisDay = async (): Promise<HistoryEvent[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date();
  const month = today.toLocaleString('default', { month: 'long' });
  const day = today.getDate();

  const prompt = `Search for 4 significant historical events that occurred on ${month} ${day} in different years. 
  Include the year, a short catchy title, and a one-sentence description for each. Return the results as a JSON array.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              year: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ['year', 'title', 'description']
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '[]');
    } catch (e) {
      return [];
    }
  } catch (error) {
    console.error("History Fetch Error:", error);
    return [];
  }
};

export const fetchNearbyPlaces = async (lat: number, lon: number, category: string): Promise<{ text: string, places: Place[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find popular and highly-rated ${category} near my coordinates (${lat}, ${lon}). Give me a very short 1-sentence summary of what's available.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lon
            }
          }
        }
      },
    });

    const text = response.text || `Exploring local ${category}...`;
    const places: Place[] = [];
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps?.uri) {
          places.push({
            title: chunk.maps.title || "View on Maps",
            uri: chunk.maps.uri
          });
        }
      });
    }

    return { text, places };
  } catch (error) {
    console.error("Places Fetch Error:", error);
    return { text: `Unable to load nearby ${category}.`, places: [] };
  }
};

export const fetchMoviesNearby = async (lat: number, lon: number): Promise<Movie[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Search for movies currently playing in cinemas near coordinates ${lat}, ${lon}. List at least 5 movies, the theaters showing them, and a one-sentence plot summary for each.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              theaters: { type: Type.ARRAY, items: { type: Type.STRING } },
              description: { type: Type.STRING }
            },
            required: ['title', 'theaters']
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '[]');
    } catch (e) {
      return [];
    }
  } catch (error) {
    console.error("Movies Fetch Error:", error);
    return [];
  }
};

export const fetchNearbyRestaurants = (lat: number, lon: number) => fetchNearbyPlaces(lat, lon, "restaurants");
export const fetchNearbyMalls = (lat: number, lon: number) => fetchNearbyPlaces(lat, lon, "shopping malls");
export const fetchNearbyTheatres = (lat: number, lon: number) => fetchNearbyPlaces(lat, lon, "movie theatres");
