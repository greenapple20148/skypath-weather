
import { GoogleGenAI, Type } from "@google/genai";
import { WeatherData, NewsItem } from "../types";

export const getAIInsight = async (weather: WeatherData): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const unit = localStorage.getItem('tempUnit') || 'C';
  const convert = (c: number) => unit === 'F' ? Math.round((c * 9) / 5 + 32) : Math.round(c);

  const prompt = `
    Context: Weather data for ${weather.location.name}, ${weather.location.country}.
    User Preferred Unit: °${unit}
    Current Temperature: ${convert(weather.current.temp)}°${unit}
    Feels Like: ${convert(weather.current.apparentTemp)}°${unit}
    Wind Speed: ${weather.current.windSpeed} km/h
    Humidity: ${weather.current.humidity}%
    Condition Code: ${weather.current.weatherCode}
    Air Quality Index (AQI): ${weather.current.aqi}
    
    Task: Provide a concise (2-3 sentences), helpful, and friendly weather insight. 
    Mention temperatures in °${unit}. 
    Include a brief mention about the air quality if it's notable (e.g., above 100).
    Mention what to wear or plan for the day based on this weather. 
    Keep it professional but warm. Use emoji sparingly.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
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
  
  const prompt = `Find the top 3-4 most recent and relevant weather news stories or environmental updates specifically for ${location} or surrounding areas. 
  Include important details like warnings, major events, or local seasonal news.`;

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
              title: { type: Type.STRING },
              snippet: { type: Type.STRING },
              url: { type: Type.STRING },
              source: { type: Type.STRING },
              date: { type: Type.STRING },
            },
            required: ['title', 'snippet', 'url', 'source'],
          },
        },
      }
    });

    let news: NewsItem[] = [];
    try {
      news = JSON.parse(response.text || '[]');
    } catch (e) {
      // Fallback if JSON parsing fails but search results were returned
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (grounding && Array.isArray(grounding)) {
        news = grounding.map((chunk: any) => ({
          title: chunk.web?.title || 'Weather Update',
          snippet: 'Click to read the latest update on local weather conditions.',
          url: chunk.web?.uri || '#',
          source: new URL(chunk.web?.uri || 'https://google.com').hostname,
          date: 'Just now'
        })).slice(0, 4);
      }
    }
    return news;
  } catch (error) {
    console.error("News Fetch Error:", error);
    return [];
  }
};
