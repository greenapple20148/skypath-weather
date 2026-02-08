import { NewsItem } from '../types';
import { getAIIntelligence } from './geminiService';

/**
 * Fetches latest headlines using Gemini's Google Search grounding.
 * This provides "AI-driven Intelligence" that works in a purely client-side
 * environment while remaining secure and up-to-date.
 */
export const fetchLocationNews = async (locationName: string): Promise<NewsItem[]> => {
  if (!locationName) return [];

  try {
    // Instead of a failing server route, we use the AI's built-in search capabilities
    // which provides grounded, real-time local intelligence.
    return await getAIIntelligence(locationName);
  } catch (error) {
    console.error("Intelligence fetch error:", error);
    return [];
  }
};