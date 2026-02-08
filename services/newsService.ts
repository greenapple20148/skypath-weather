import { NewsItem } from '../types';
import { getAIIntelligence } from './geminiService';

/**
 * Hybrid Intelligence Fetcher
 * Attempts to use NewsAPI.org via a secure backend proxy.
 * Falls back to Gemini Google Search Grounding if the backend is inactive or fails.
 */
export const fetchLocationNews = async (locationName: string): Promise<NewsItem[]> => {
  if (!locationName) return [];

  try {
    // Step 1: Attempt to fetch from our internal NewsAPI proxy
    const response = await fetch(`/api/news?location=${encodeURIComponent(locationName)}`);
    
    // Step 2: Safety check for the "Unexpected token 'e'" error
    // If the server returns plain text (the source code) instead of JSON,
    // the contentType header will likely not be 'application/json'.
    const contentType = response.headers.get('content-type');
    
    if (response.ok && contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as NewsItem[];
      }
    }
    
    // Step 3: Fallback to AI Search Grounding
    // This happens if the backend is misconfigured or returning the .ts source code
    console.warn("Backend NewsAPI unavailable or misconfigured. Falling back to AI Intelligence.");
    return await getAIIntelligence(locationName);
    
  } catch (error) {
    console.error("Intelligence link error, triggering AI fallback:", error);
    return await getAIIntelligence(locationName);
  }
};