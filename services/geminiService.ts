
import { GoogleGenAI } from "@google/genai";
import { WeatherData } from "../types";

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
