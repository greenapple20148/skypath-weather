import { NewsItem } from '../types';

/**
 * Fetches latest headlines related to the location and weather context.
 * Requires a valid NEWS_API_KEY in the environment.
 */
export const fetchLocationNews = async (locationName: string): Promise<NewsItem[]> => {
  const apiKey = (process.env as any).NEWS_API_KEY;
  if (!apiKey) {
    console.warn("News API Key missing. News feed will be disabled.");
    return [];
  }

  // We query for weather-related or local news to keep it relevant to SkyCast
  const query = encodeURIComponent(`${locationName} weather OR ${locationName} news`);
  const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('News fetch failed');
    const data = await response.json();
    
    return (data.articles || []).map((art: any) => ({
      title: art.title,
      snippet: art.description || art.content || "Read more about this atmospheric event.",
      url: art.url,
      source: art.source.name,
      date: art.publishedAt
    }));
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
};