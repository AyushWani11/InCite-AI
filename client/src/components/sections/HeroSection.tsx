import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Star } from 'lucide-react';
import { Button } from '../common';

const HeroSection: React.FC = () => {
  return (
    <section className="pt-20 pb-16 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Transform Your <br />
                Research with{' '}
                <span className="text-teal-500">AI-Powered</span>{' '}
                Paper Management
              </h1>
              
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
                Streamline your academic workflow with intelligent
                summarization, semantic search, and interactive chat for your
                research papers.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/dashboard">
                <Button size="lg" className="bg-teal-500 hover:bg-teal-600 group">
                  Upload Paper Now
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              
              <Button variant="outline" size="lg" className="group">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Trust Indicators
            <div className="flex items-center space-x-8 pt-8">
              <div className="flex items-center space-x-2">
                <div className="flex -space-x-1">
                  <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white"></div>
                  <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-white"></div>
                </div>
                <div className="text-sm text-gray-600">
                  <div className="font-semibold">Trusted by 10,000+ researchers</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-1">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-gray-600 ml-2">4.9/5</span>
              </div>
            </div> */}
          </div>

          {/* Right Content - Dashboard Preview */}
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              {/* Dashboard Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="text-sm font-medium text-gray-600">
                    InCite AI Dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="p-6 space-y-6">
                <div className="text-lg font-semibold text-gray-800">
                  Research Assistant
                  <span className="text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full ml-2">
                    Powered by Gemini AI
                  </span>
                </div>

                {/* Upload Area */}
                <div className="border-2 border-dashed border-teal-200 rounded-lg p-6 text-center">
                  <div className="text-teal-500 text-4xl mb-2">+</div>
                  <div className="text-sm text-gray-600">
                    <div className="font-medium">Upload your research paper</div>
                    <div>PDF, DOC, or plain text formats supported</div>
                  </div>
                </div>

                {/* AI Summary Preview */}
                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-teal-800">AI Summary</div>
                    <div className="text-xs text-teal-600">Generated in 3.2s</div>
                  </div>
                  <div className="text-sm text-teal-700">
                    This paper introduces a novel approach to natural language processing using
                    transformer architectures with self-attention mechanisms. The authors
                    demonstrate a 12% improvement over previous state-of-the-art methods on
                    standard benchmarks.
                  </div>
                </div>

                {/* Chat Interface Preview */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium">Ask about this paper</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="What are the key findings?"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      readOnly
                    />
                    <Button size="sm" className="bg-teal-500 hover:bg-teal-600">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex space-x-4">
                    <Button size="sm" className="bg-teal-500 hover:bg-teal-600">
                      Get Summary
                    </Button>
                    <Button variant="outline" size="sm">
                      Chat with Paper
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements for visual interest */}
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-teal-200 rounded-full opacity-60"></div>
            <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-blue-200 rounded-full opacity-40"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;