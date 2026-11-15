import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Send, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { buttonClasses } from '../common';

const examplePapers = [
	'Agentic Retrieval for Research QA',
	'A Survey of Efficient Transformers',
	'Coral Reef Recovery After Bleaching',
];

// A picture of the dashboard, drawn with HTML so it stays sharp. It is not
// interactive, so screen readers skip it.
const DashboardPreview: React.FC = () => (
	<div
		aria-hidden='true'
		className='rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden select-none'
	>
		<div className='flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-gray-50'>
			<span className='w-3 h-3 rounded-full bg-gray-300' />
			<span className='w-3 h-3 rounded-full bg-gray-300' />
			<span className='w-3 h-3 rounded-full bg-gray-300' />
			<span className='ml-2 text-xs text-gray-500'>InCite AI</span>
		</div>
		<div className='grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
			<div className='hidden sm:block border-r border-gray-100 bg-gray-50/60 p-3 space-y-2'>
				<p className='px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500'>Your papers</p>
				{examplePapers.map((title, i) => (
					<div
						key={title}
						className={clsx(
							'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-snug',
							i === 0 ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-gray-200 bg-white text-gray-700'
						)}
					>
						<FileText className='w-3.5 h-3.5 mt-0.5 shrink-0' />
						{title}
					</div>
				))}
			</div>
			<div className='p-4 space-y-3 text-sm'>
				<div className='ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-teal-700 px-3 py-2 text-white'>
					How does the planner decide what to search for?
				</div>
				<div className='max-w-[92%] rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3 py-2 text-gray-800 shadow-sm'>
					<p>
						It splits the question into <strong>sub-queries</strong>, retrieves passages for each one, and
						drops passages that don't support the answer.
					</p>
					<p className='mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500'>
						<span className='font-medium text-gray-600'>Sources:</span> Agentic Retrieval for Research QA
						(excerpts 3, 7)
					</p>
				</div>
				<div className='flex items-center gap-2 pt-1'>
					<div className='flex-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-400'>
						Ask about this paper…
					</div>
					<div className='w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center'>
						<Send className='w-4 h-4 text-white' />
					</div>
				</div>
			</div>
		</div>
	</div>
);

const HeroSection: React.FC = () => (
	// The extra top padding clears the fixed 64px navbar.
	<section className='bg-linear-to-b from-teal-50/70 to-white'>
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 sm:pt-36 sm:pb-16'>
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
				<div className='space-y-8'>
					<div className='space-y-5'>
						<p className='inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-800'>
							<Sparkles className='w-4 h-4' aria-hidden='true' />
							Answers grounded in your own papers
						</p>
						<h1 className='text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight text-balance'>
							Chat with your <span className='text-teal-700'>research papers</span>
						</h1>
						<p className='text-lg sm:text-xl text-gray-600 leading-relaxed max-w-xl'>
							Upload PDFs and ask questions in plain language. Every answer names the paper and passages it
							came from, and one click gives you a structured summary or a reviewer-style assessment.
						</p>
					</div>

					<div className='flex flex-col sm:flex-row gap-3'>
						<Link to='/dashboard' className={buttonClasses('primary', 'lg', 'group')}>
							Get started
							<ArrowRight
								className='w-5 h-5 transition-transform group-hover:translate-x-1'
								aria-hidden='true'
							/>
						</Link>
						<a href='#how-it-works' className={buttonClasses('outline', 'lg')}>
							See how it works
						</a>
					</div>
				</div>

				<DashboardPreview />
			</div>
		</div>
	</section>
);

export default HeroSection;
