/**
 * INACTIVE ROUTE
 * This file is being served as a static asset by the current host.
 * Logic has been moved to 'services/geminiService.ts' to use 
 * AI-powered Search Grounding which works in static environments.
 */
export default async function handler() {
  return new Response(JSON.stringify({ error: "Use client-side Gemini Intelligence instead." }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' }
  });
}