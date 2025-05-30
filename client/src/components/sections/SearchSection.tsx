import React from 'react';
import { Search, Check, Zap } from 'lucide-react';

const SearchSection: React.FC = () => {
  const searchResults = [
    {
      title: 'Transformer-based NLP for Scientific Text Analysis',
      authors: 'Johnson et al., 2023',
      journal: 'Nature Machine Intelligence',
      match: '98%',
      matchColor: 'bg-green-500'
    },
    {
      title: 'Attention Mechanisms in Scientific Document Processing',
      authors: 'Zhang & Williams, 2022',
      journal: 'ACL Conference',
      match: '87%',
      matchColor: 'bg-blue-500'
    },
    {
      title: 'Large Language Models for Academic Research',
      authors: 'Chen et al., 2023',
      journal: 'arXiv preprint',
      match: '82%',
      matchColor: 'bg-blue-500'
    },
    {
      title: 'Self-Attention Networks for Citation Analysis',
      authors: 'Patel & Rodriguez, 2022',
      journal: 'EMNLP',
      match: '75%',
      matchColor: 'bg-yellow-500'
    }
  ];

  const features = [
    'Context-aware search across your entire library',
    'Find related concepts, not just exact matches',
    'Powered by Gemini AI for superior understanding'
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-medium">
                <Zap className="w-4 h-4" />
                <span>Smart Semantic Search</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Find exactly what you need, instantly
              </h2>
              
              <p className="text-lg text-gray-600 leading-relaxed">
                Our advanced semantic search understands the meaning behind
                your queries, not just keywords. Find relevant research across
                your entire library in seconds.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <Check className="w-6 h-6 text-teal-500 mt-0.5" />
                  </div>
                  <p className="text-gray-700 font-medium">{feature}</p>
                </div>
              ))}
            </div>

            {/* Search Demo */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Try a search query:</h3>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search your research library..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    defaultValue="machine learning attention mechanisms"
                  />
                </div>
                
                <div className="text-sm text-gray-500">
                  Search across titles, abstracts, keywords, and full text content
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Search Results */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              {/* Search Results Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Search Results</h3>
                  <span className="text-sm text-gray-500">4 papers found</span>
                </div>
              </div>

              {/* Search Results List */}
              <div className="divide-y divide-gray-100">
                {searchResults.map((result, index) => (
                  <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900 leading-snug pr-4">
                        {result.title}
                      </h4>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${result.matchColor}`}></div>
                        <span className="text-sm font-semibold text-gray-700">
                          {result.match} match
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">{result.authors}</p>
                      <p className="text-sm text-gray-500">{result.journal}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Search Stats */}
              <div className="bg-teal-50 px-6 py-4 border-t border-teal-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-teal-700">Search completed in 0.23 seconds</span>
                  <span className="text-teal-600">Relevance sorted</span>
                </div>
              </div>
            </div>

            {/* Floating search icon */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center shadow-lg">
              <Search className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchSection;