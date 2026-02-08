import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { WeatherData, Place, Movie, NewsItem } from "../types";

/**
 * Utility to retry an async function with exponential backoff.
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

/**
 * Fetches real-time intelligence (news/events) for a location using Google Search Grounding.
 * This fulfills the request for 'server-side' data processing without needing a custom Node server.
 */
export const getAIIntelligence = async (locationName: string): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Find 4 high-priority recent news headlines or local events happening in ${locationName}. 
  Focus on current affairs, community events, or weather-related news. 
  For each item, provide a title and a clear summary sentence.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }));

    const newsItems: NewsItem[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    // We parse the model response and match it with grounding links
    const textLines = (response.text || "").split('\n').filter(l => l.trim().length > 5);
    
    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk: any, index: number) => {
        if (chunk.web) {
          newsItems.push({
            title: chunk.web.title || `Intelligence Report ${index + 1}`,
            snippet: textLines[index] || "Full telemetry report available via source link.",
            url: chunk.web.uri,
            source: "AI Search Grounding",
            date: new Date().toISOString()
          });
        }
      });
    }

    return newsItems.slice(0, 4);
  } catch (error) {
    console.error("AI Intelligence Error:", error);
    return [];
  }
};

export const fetchDailyQuote = async (weatherDesc: string): Promise<{ text: string; author: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Provide one inspiring, poetic, or philosophical quote about nature, the sky, or the atmosphere that fits a "${weatherDesc}" day. 
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

export const fetchNearbyPlaces = async (lat: number, lon: number, category: string): Promise<{ text: string, places: Place[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find popular and highly-rated ${category} near my coordinates (${lat}, ${lon}).`,
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
  const prompt = `List 5 movies currently playing in cinemas near coordinates ${lat}, ${lon}. Return the results as a JSON array.`;

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