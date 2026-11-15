import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, MessageSquare, ClipboardList } from 'lucide-react';

const steps = [
	{
		icon: Upload,
		title: 'Upload your papers',
		text: 'Click Upload PDF and pick up to 10 files. InCite extracts the text, splits it into passages and indexes them for search.',
	},
	{
		icon: MessageSquare,
		title: 'Ask questions',
		text: 'Pick a paper or ask across all of them. Answers appear as they are written and end with their sources.',
	},
	{
		icon: ClipboardList,
		title: 'Summarize and assess',
		text: 'One click gives a structured summary or a reviewer-style assessment. Both are saved, so they open instantly next time.',
	},
];

const HowItWorksSection: React.FC = () => (
	<section id='how-it-works' className='py-20 bg-white scroll-mt-16'>
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
			<div className='text-center space-y-4 mb-14'>
				<h2 className='text-3xl md:text-4xl font-bold text-gray-900'>How it works</h2>
				<p className='text-lg text-gray-600 max-w-2xl mx-auto'>Three steps from PDF to answers.</p>
			</div>

			<ol className='grid grid-cols-1 md:grid-cols-3 gap-6'>
				{steps.map(({ icon: Icon, title, text }, i) => (
					<li key={title} className='relative rounded-2xl bg-gray-50 p-6 pt-8'>
						<span className='absolute -top-4 left-6 w-8 h-8 rounded-full bg-teal-700 text-white text-sm font-bold flex items-center justify-center'>
							{i + 1}
						</span>
						<Icon className='w-7 h-7 text-teal-700 mb-4' aria-hidden='true' />
						<h3 className='text-lg font-semibold text-gray-900 mb-2'>{title}</h3>
						<p className='text-gray-600 leading-relaxed'>{text}</p>
					</li>
				))}
			</ol>

			<div className='mt-20 rounded-3xl bg-teal-800 px-6 py-12 sm:p-12 text-center text-white'>
				<h2 className='text-2xl md:text-3xl font-bold mb-3'>Try it with your own papers</h2>
				<p className='text-lg text-teal-100 max-w-xl mx-auto mb-8'>
					Create an account, upload a PDF and ask your first question.
				</p>
				<div className='flex flex-col sm:flex-row gap-3 justify-center'>
					<Link
						to='/signup'
						className='inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-teal-800 hover:bg-teal-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-800'
					>
						Create an account
					</Link>
					<Link
						to='/login'
						className='inline-flex items-center justify-center rounded-lg border-2 border-white/70 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-teal-800'
					>
						Log in
					</Link>
				</div>
			</div>
		</div>
	</section>
);

export default HowItWorksSection;
