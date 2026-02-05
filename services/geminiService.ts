// DO import GenerateContentResponse for proper typing
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { WeatherData, NewsItem, Place, Movie, HistoryEvent, ImageSize } from "../types";

/**
 * Utility to retry an async function with exponential backoff.
 * Handles transient errors like 503 (Overloaded) or 429 (Rate Limit).
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const status = error?.status || error?.error?.status;
    const isTransient = status === 503 || status === 504 || status === 429;
    
    if (retries > 0 && isTransient) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

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
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    }));
    
    return response.text || "No AI insight available at the moment.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "The AI weather specialist is currently taking a coffee break. Dress comfortably!";
  }
};

export const fetchDailyQuote = async (weatherDesc: string): Promise<{ text: string; author: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date().toLocaleDateString();
  
  const prompt = `Provide one inspiring, poetic, or philosophical quote about nature, the sky, or the atmosphere that fits a "${weatherDesc}" day. 
  It can be from a famous person or an original composition by "SkyCast AI". 
  Return it as a JSON object with properties "text" and "author".`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ['text', 'author']
        }
      }
    }));

    return JSON.parse(response.text || '{"text": "Even the darkest clouds are eventually scattered by the sun.", "author": "SkyCast AI"}');
  } catch (error) {
    console.error("Quote Fetch Error:", error);
    return { text: "Nature always wears the colors of the spirit.", author: "Ralph Waldo Emerson" };
  }
};

export const fetchHistoryOnThisDay = async (): Promise<HistoryEvent[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const today = new Date();
  const month = today.toLocaleString('default', { month: 'long' });
  const day = today.getDate();

  const prompt = `Provide 4 significant historical events that occurred on ${month} ${day} in different years. 
  Include the year, a short catchy title, and a one-sentence description for each. Return the results as a JSON array.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
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
    }));

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
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
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
    }));

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
  
  const prompt = `List 5 movies currently playing in cinemas near coordinates ${lat}, ${lon}. Include the theaters showing them, and a one-sentence plot summary for each. Return the results as a JSON array.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
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
    }));

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