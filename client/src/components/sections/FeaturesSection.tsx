import React from 'react';
import { Upload, Brain, MessageCircle, CheckCircle } from 'lucide-react';
import { Button } from '../common';
import { Link } from 'react-router-dom';

const FeaturesSection: React.FC = () => {
	const features = [
		{
			icon: Upload,
			title: 'Upload Paper',
			description:
				'Easily upload your research papers in PDF, DOC, or plain text formats for instant processing.',
			buttonText: 'Upload Now',
			color: 'teal',
		},
		{
			icon: Brain,
			title: 'AI Summarization',
			description:
				'Get concise, accurate summaries of complex research papers in seconds with our advanced AI.',
			buttonText: 'Get Summary',
			color: 'teal',
		},
		{
			icon: MessageCircle,
			title: 'Chat Assistant',
			description:
				'Ask questions about your papers and get intelligent, contextual responses from our AI assistant.',
			buttonText: 'Chat with Paper',
			color: 'teal',
		},
		{
			icon: CheckCircle,
			title: 'Quality Assessment',
			description:
				'Evaluate research quality with AI-powered analysis of methodology, data, and conclusions.',
			buttonText: 'Assess Quality',
			color: 'teal',
		},
	];

	return (
		<section id='features' className='py-20 bg-white'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				{/* Section Header */}
				<div className='text-center space-y-4 mb-16'>
					<h2 className='text-3xl md:text-4xl font-bold text-gray-900'>
						Powerful AI Features
					</h2>
					<p className='text-lg text-gray-600 max-w-2xl mx-auto'>
						Transform how you interact with research papers using our advanced
						AI tools
					</p>
				</div>

				{/* Features Grid */}
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8'>
					{features.map((feature, index) => {
						const Icon = feature.icon;
						return (
							<div key={index} className='group'>
								<div className='bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300 h-full'>
									{/* Icon */}
									<div className='mb-6'>
										<div className='w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center group-hover:bg-teal-200 transition-colors'>
											<Icon className='w-8 h-8 text-teal-600' />
										</div>
									</div>

									{/* Content */}
									<div className='space-y-4'>
										<h3 className='text-xl font-semibold text-gray-900'>
											{feature.title}
										</h3>

										<p className='text-gray-600 leading-relaxed'>
											{feature.description}
										</p>

										<div className='pt-4'>
											<Link to='/dashboard'>
												<Button
													size='sm'
													className='bg-teal-500 hover:bg-teal-600 w-full group-hover:shadow-md transition-shadow'
												>
													{feature.buttonText}
												</Button>
											</Link>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Additional Features Preview */}
				<div className='mt-20 bg-gray-50 rounded-3xl p-8 md:p-12'>
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
						<div className='space-y-6'>
							<h3 className='text-2xl md:text-3xl font-bold text-gray-900'>
								Everything you need for research success
							</h3>

							<div className='space-y-4'>
								<div className='flex items-start space-x-3'>
									<CheckCircle className='w-6 h-6 text-teal-500 mt-0.5 flex-shrink-0' />
									<div>
										<h4 className='font-semibold text-gray-900'>
											Intelligent Document Processing
										</h4>
										<p className='text-gray-600'>
											Advanced OCR and text extraction from any document format
										</p>
									</div>
								</div>

								<div className='flex items-start space-x-3'>
									<CheckCircle className='w-6 h-6 text-teal-500 mt-0.5 flex-shrink-0' />
									<div>
										<h4 className='font-semibold text-gray-900'>
											Citation Management
										</h4>
										<p className='text-gray-600'>
											Automatic citation extraction and bibliography generation
										</p>
									</div>
								</div>

								<div className='flex items-start space-x-3'>
									<CheckCircle className='w-6 h-6 text-teal-500 mt-0.5 flex-shrink-0' />
									<div>
										<h4 className='font-semibold text-gray-900'>
											Collaboration Tools
										</h4>
										<p className='text-gray-600'>
											Share insights and annotations with your research team
										</p>
									</div>
								</div>

								<div className='flex items-start space-x-3'>
									<CheckCircle className='w-6 h-6 text-teal-500 mt-0.5 flex-shrink-0' />
									<div>
										<h4 className='font-semibold text-gray-900'>
											Export Capabilities
										</h4>
										<p className='text-gray-600'>
											Export summaries and insights in multiple formats
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className='relative'>
							<div className='bg-white rounded-2xl shadow-xl p-6'>
								<div className='space-y-4'>
									<div className='flex items-center justify-between'>
										<h4 className='font-semibold text-gray-900'>
											Research Analytics
										</h4>
										<span className='text-xs bg-teal-100 text-teal-600 px-2 py-1 rounded-full'>
											Live
										</span>
									</div>

									<div className='space-y-3'>
										<div className='flex justify-between text-sm'>
											<span className='text-gray-600'>Papers Processed</span>
											<span className='font-semibold'>1,247</span>
										</div>
										<div className='w-full bg-gray-200 rounded-full h-2'>
											<div
												className='bg-teal-500 h-2 rounded-full'
												style={{ width: '85%' }}
											></div>
										</div>

										<div className='flex justify-between text-sm'>
											<span className='text-gray-600'>Time Saved</span>
											<span className='font-semibold'>342 hours</span>
										</div>
										<div className='w-full bg-gray-200 rounded-full h-2'>
											<div
												className='bg-blue-500 h-2 rounded-full'
												style={{ width: '92%' }}
											></div>
										</div>

										<div className='flex justify-between text-sm'>
											<span className='text-gray-600'>Quality Score</span>
											<span className='font-semibold'>96%</span>
										</div>
										<div className='w-full bg-gray-200 rounded-full h-2'>
											<div
												className='bg-green-500 h-2 rounded-full'
												style={{ width: '96%' }}
											></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default FeaturesSection;
