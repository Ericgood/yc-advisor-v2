import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">YC Advisor Knowledge Base v2</h1>
        <p className="text-gray-300 mb-8">
          Modern TypeScript implementation with fast search capabilities.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">📚 Resources</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• 443 curated startup resources</li>
              <li>• 31 categories</li>
              <li>• Essays, videos, and podcasts</li>
              <li>• Full-text searchable</li>
            </ul>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">🔍 Search</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Multi-level retrieval</li>
              <li>• Keyword scoring</li>
              <li>• Faceted navigation</li>
              <li>• &lt;50ms response time</li>
            </ul>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">⚡ API</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• RESTful endpoints</li>
              <li>• TypeScript types</li>
              <li>• LRU caching</li>
              <li>• Edge-ready</li>
            </ul>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">📖 Documentation</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• <Link href="/api/knowledge/categories" className="text-blue-400 hover:underline">Categories API</Link></li>
              <li>• <Link href="/api/knowledge/search?q=fundraising" className="text-blue-400 hover:underline">Search API</Link></li>
              <li>• Type-safe implementation</li>
              <li>• Comprehensive types</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-2">Example API Usage:</h3>
          <code className="block bg-gray-900 p-3 rounded text-sm text-green-400">
            GET /api/knowledge/search?q=fundraising&category=ai&limit=5
          </code>
        </div>
      </div>
    </main>
  );
}
