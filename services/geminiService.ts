
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
  const preferredCountry = localStorage.getItem('preferredCountry') || '';
  const convert = (c: number) => unit === 'F' ? Math.round((c * 9) / 5 + 32) : Math.round(c);

  const prompt = `
    Context: Weather data for ${weather.location.name}, ${weather.location.country}.
    User Preferred Unit: °${unit}
    ${preferredCountry ? `User Preferred Region: ${preferredCountry}` : ''}
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
 * Generates an atmospheric image for a specific place using gemini-2.5-flash-image.
 */
export const generatePlaceImage = async (placeTitle: string, weatherDesc: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `A high-quality, realistic photography shot of the exterior or interior of "${placeTitle}". The mood should be influenced by ${weatherDesc} weather. Professional architectural or travel photography style. 4k resolution.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    }));

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return undefined;
  } catch (error) {
    console.error("Place Image Generation Error:", error);
    return undefined;
  }
};

/**
 * Fetches nearby places based on coordinates and category.
 * Uses gemini-2.5-flash with Google Maps tools.
 * Limits to 10 items per category.
 */
export const fetchNearbyPlacesByCategory = async (
  lat: number, 
  lon: number, 
  category: string,
  weatherDesc: string
): Promise<Place[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const preferredCountry = localStorage.getItem('preferredCountry') || '';
  
  const prompt = `Find up to 10 best rated and popular ${category} near coordinates (${lat}, ${lon})${preferredCountry ? ` in ${preferredCountry}` : ''}. The current weather is ${weatherDesc}. Only provide real, existing places with valid Google Maps links.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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

    const places: Place[] = [];
    const uniqueUris = new Set<string>();
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps?.uri && places.length < 10) {
          if (!uniqueUris.has(chunk.maps.uri)) {
            uniqueUris.add(chunk.maps.uri);
            places.push({
              title: chunk.maps.title || "Local Venue",
              uri: chunk.maps.uri
            });
          }
        }
      });
    }

    return places;
  } catch (error) {
    console.error(`Error fetching ${category}:`, error);
    return [];
  }
};

/**
 * Legacy support / Combined suggested activities
 */
export const fetchNearbyPlaces = async (lat: number, lon: number, weatherDesc: string): Promise<{ suggestion: string, places: Place[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const preferredCountry = localStorage.getItem('preferredCountry') || '';
  
  const prompt = `The current weather is "${weatherDesc}". Based on this, suggest 4 nearby venues or places that would be great to visit right now near (${lat}, ${lon})${preferredCountry ? ` in ${preferredCountry}` : ''}. Provide a very short 1-sentence reason for these suggestions.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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

    const suggestion = response.text || `Great places to visit in this weather:`;
    const places: Place[] = [];
    const uniqueUris = new Set<string>();
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.maps?.uri && places.length < 4) {
          if (!uniqueUris.has(chunk.maps.uri)) {
            uniqueUris.add(chunk.maps.uri);
            places.push({
              title: chunk.maps.title || "Local Venue",
              uri: chunk.maps.uri
            });
          }
        }
      });
    }

    return { suggestion, places };
  } catch (error) {
    console.error("Places Fetch Error:", error);
    return { suggestion: "Exploring local highlights...", places: [] };
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

export const getAIIntelligence = async (locationName: string): Promise<NewsItem[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const preferredCountry = localStorage.getItem('preferredCountry') || '';
  const prompt = `What are the most recent news stories and events happening in ${locationName}${preferredCountry ? `, ${preferredCountry}` : ''}? Provide a summary of the top news.`;

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

    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          newsItems.push({
            title: chunk.web.title || "News Update",
            snippet: "Direct intelligence report from web telemetry. Click to view full coverage.",
            url: chunk.web.uri,
            source: "Verified Web Source",
            date: new Date().toISOString()
          });
        }
      });
    }

    const uniqueNews = Array.from(new Map(newsItems.map(item => [item.url, item])).values());
    
    return uniqueNews.slice(0, 6);
  } catch (error) {
    console.error("AI Intelligence Error:", error);
    return [];
  }
};
