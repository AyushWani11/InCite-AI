import React from 'react';
import { Upload, Quote, Library, BookOpen, ClipboardCheck, Lock, Mic, ScanText } from 'lucide-react';

// Only features the app really has. Keep this in sync with the README.
const features = [
	{
		icon: Upload,
		title: 'Upload PDFs',
		text: 'Add up to 10 PDFs at once. InCite extracts the text, finds the authors and keywords, and indexes every passage for search.',
	},
	{
		icon: Quote,
		title: 'Answers with sources',
		text: 'Each answer names the paper and the excerpts it used, so you can check it against the PDF.',
	},
	{
		icon: Library,
		title: 'One paper or all of them',
		text: 'Select a paper to focus on it, or ask a general question and InCite picks the most relevant paper for you.',
	},
	{
		icon: BookOpen,
		title: 'Structured summaries',
		text: 'Abstract, contributions, methodology, findings and conclusion, based on a reading of the whole paper.',
	},
	{
		icon: ClipboardCheck,
		title: 'Reviewer-style assessment',
		text: 'Ratings for writing, methodology and academic standards, a score out of 100, and concrete suggestions.',
	},
	{
		icon: Lock,
		title: 'Private to your account',
		text: "Only you can open your papers, and their search index is kept apart from every other user's.",
	},
];

const notes = [
	{ icon: Mic, text: 'Speak your questions and have answers read aloud, in browsers that support it.' },
	{ icon: ScanText, text: 'Works with PDFs that contain text. Scanned, image-only PDFs can’t be read yet.' },
];

const FeaturesSection: React.FC = () => (
	<section id='features' className='py-20 bg-white scroll-mt-16'>
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
			<div className='text-center space-y-4 mb-14'>
				<h2 className='text-3xl md:text-4xl font-bold text-gray-900'>What InCite does</h2>
				<p className='text-lg text-gray-600 max-w-2xl mx-auto'>
					Read papers faster, without having to take the AI's word for it.
				</p>
			</div>

			<ul className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
				{features.map(({ icon: Icon, title, text }) => (
					<li key={title} className='rounded-2xl border border-gray-200 bg-white p-6 hover:border-teal-300 transition-colors'>
						<div className='w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5'>
							<Icon className='w-6 h-6 text-teal-700' aria-hidden='true' />
						</div>
						<h3 className='text-lg font-semibold text-gray-900 mb-2'>{title}</h3>
						<p className='text-gray-600 leading-relaxed'>{text}</p>
					</li>
				))}
			</ul>

			<ul className='mt-8 grid grid-cols-1 md:grid-cols-2 gap-4'>
				{notes.map(({ icon: Icon, text }) => (
					<li key={text} className='flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600'>
						<Icon className='w-5 h-5 text-gray-500 shrink-0' aria-hidden='true' />
						{text}
					</li>
				))}
			</ul>
		</div>
	</section>
);

export default FeaturesSection;
