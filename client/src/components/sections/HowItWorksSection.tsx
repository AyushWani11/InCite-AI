import React from 'react';
import { Upload, Brain, MessageSquare } from 'lucide-react';

const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: '1',
      icon: Upload,
      title: 'Upload Your Papers',
      description: 'Simply drag and drop your research papers in PDF, DOC, or text format. Our AI will process and analyze them instantly.',
      details: [
        'Multiple file format support',
        'Batch upload capability',
        'Automatic text extraction and OCR'
      ]
    },
    {
      number: '2',
      icon: Brain,
      title: 'AI Processing',
      description: 'Our Gemini AI analyzes your papers, extracting key information, generating summaries, and preparing for interactive chat.',
      details: [
        'Advanced natural language processing',
        'Key insight extraction',
        'Semantic understanding and indexing'
      ]
    },
    {
      number: '3',
      icon: MessageSquare,
      title: 'Interact & Discover',
      description: 'Ask questions, get summaries, search semantically, and assess quality - all through our intuitive interface.',
      details: [
        'Interactive Q&A with your papers',
        'Smart search and discovery',
        'Quality assessment and insights'
      ]
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            How It Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get started in minutes with our simple three-step process
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isEven = index % 2 === 1;
            
            return (
              <div key={index} className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${isEven ? 'lg:flex-row-reverse' : ''}`}>
                {/* Content */}
                <div className={`space-y-6 ${isEven ? 'lg:order-2' : ''}`}>
                  {/* Step Number */}
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-teal-600">{step.number}</span>
                    </div>
                    <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Title and Description */}
                  <div className="space-y-4">
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Details */}
                  <div className="space-y-3">
                    {step.details.map((detail, detailIndex) => (
                      <div key={detailIndex} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                        <span className="text-gray-700">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual */}
                <div className={`relative ${isEven ? 'lg:order-1' : ''}`}>
                  <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-3xl p-8 lg:p-12">
                    {/* Step 1 Visual - Upload */}
                    {index === 0 && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-500 rounded-2xl mb-4">
                            <Upload className="w-10 h-10 text-white" />
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-2">Drag & Drop Interface</h4>
                        </div>
                        
                        <div className="border-2 border-dashed border-teal-300 rounded-2xl p-8 bg-white/50">
                          <div className="text-center space-y-2">
                            <div className="text-teal-500 text-4xl">📄</div>
                            <p className="text-sm text-gray-600 font-medium">
                              Drop your research papers here
                            </p>
                            <p className="text-xs text-gray-500">
                              PDF, DOC, TXT supported
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-center space-x-2">
                          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse"></div>
                          <div className="w-3 h-3 bg-teal-300 rounded-full"></div>
                          <div className="w-3 h-3 bg-teal-200 rounded-full"></div>
                        </div>
                      </div>
                    )}

                    {/* Step 2 Visual - AI Processing */}
                    {index === 1 && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-500 rounded-2xl mb-4">
                            <Brain className="w-10 h-10 text-white" />
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-2">AI Analysis in Progress</h4>
                        </div>
                        
                        <div className="bg-white/70 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Extracting content...</span>
                            <span className="text-xs text-teal-600">98%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-teal-500 h-2 rounded-full" style={{ width: '98%' }}></div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Generating summary...</span>
                            <span className="text-xs text-teal-600">85%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Building knowledge graph...</span>
                            <span className="text-xs text-teal-600">72%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '72%' }}></div>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <span className="text-xs text-gray-500">Powered by Gemini AI</span>
                        </div>
                      </div>
                    )}

                    {/* Step 3 Visual - Interaction */}
                    {index === 2 && (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-500 rounded-2xl mb-4">
                            <MessageSquare className="w-10 h-10 text-white" />
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-2">Interactive Dashboard</h4>
                        </div>
                        
                        <div className="bg-white/70 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">AI</span>
                            </div>
                            <div className="flex-1 bg-blue-50 rounded-lg p-3">
                              <p className="text-sm text-gray-700">
                                This paper discusses transformer architectures for NLP tasks...
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-gray-600">You</span>
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-lg p-3">
                              <p className="text-sm text-gray-700">
                                What are the key findings?
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 pt-2">
                            <button className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                              Get Summary
                            </button>
                            <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              Quality Score
                            </button>
                            <button className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              Related Papers
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Floating elements */}
                  <div className="absolute -top-4 -right-4 w-8 h-8 bg-teal-200 rounded-full opacity-60"></div>
                  <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-blue-200 rounded-full opacity-40"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-gradient-to-r from-teal-500 to-blue-600 rounded-3xl p-12 text-white">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to transform your research workflow?
          </h3>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of researchers who are already using AI to accelerate their work
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-teal-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Start Free Trial
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-teal-600 transition-colors">
              Schedule Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;