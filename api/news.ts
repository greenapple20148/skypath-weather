/**
 * Server-side route for fetching news via newsapi.org.
 * Handles API key concealment and data mapping.
 */
export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get('location');
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'NEWS_API_KEY not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!location) {
    return new Response(JSON.stringify({ error: 'Location required' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Construct query for the location
  const query = encodeURIComponent(`${location} news`);
  const url = `https://newsapi.org/v2/everything?q=${query}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map external API results to our internal NewsItem type
    const articles = (data.articles || []).map((art: any) => ({
      title: art.title,
      snippet: art.description || art.content || "Click to read full intelligence report.",
      url: art.url,
      source: art.source.name || "NewsAPI",
      date: art.publishedAt
    }));

    return new Response(JSON.stringify(articles), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=900, stale-while-revalidate'
      }
    });
  } catch (error) {
    console.error("NewsAPI Proxy Error:", error);
    return new Response(JSON.stringify({ error: 'Failed to fetch from NewsAPI' }), { 
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}