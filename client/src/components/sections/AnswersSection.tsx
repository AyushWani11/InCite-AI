import React from 'react';
import { Check } from 'lucide-react';

const points = [
	'Your question is compared with every passage in your papers, and only the best matches are given to the AI (Google Gemini).',
	'Short papers are read in full. Long ones are searched for their most relevant passages.',
	'Summaries and assessments always read the whole paper, even long ones.',
];

// The "not found" reply below is the server's real wording (server/routes/chat.js).
const ExampleChat: React.FC = () => (
	<div aria-hidden='true' className='rounded-2xl border border-gray-200 bg-white p-5 shadow-lg space-y-3 text-sm select-none'>
		<div className='ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-teal-700 px-3 py-2 text-white'>
			What accuracy gain did the authors report?
		</div>
		<div className='max-w-[92%] rounded-2xl rounded-bl-md border border-gray-200 px-3 py-2 text-gray-800'>
			<p>
				Exact-match accuracy rose from <strong>41.2% to 53.8%</strong> on multi-hop questions.
			</p>
			<p className='mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500'>
				<span className='font-medium text-gray-600'>Sources:</span> Agentic Retrieval for Research QA (excerpts 2, 5)
			</p>
		</div>
		<div className='ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-teal-700 px-3 py-2 text-white'>
			What is the boiling point of ethanol?
		</div>
		<div className='max-w-[92%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-3 py-2 text-gray-800'>
			I couldn't find anything about that in your papers. Try selecting a paper, or rephrase your question.
		</div>
	</div>
);

const AnswersSection: React.FC = () => (
	<section className='py-20 bg-gray-50'>
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
			<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
				<div className='space-y-6'>
					<h2 className='text-3xl md:text-4xl font-bold text-gray-900'>Answers you can check</h2>
					<p className='text-lg text-gray-600 leading-relaxed'>
						InCite answers from your papers, not from the open internet. Every answer lists the paper and
						excerpts it used, and if nothing in your library covers the question, it tells you instead of
						guessing.
					</p>
					<ul className='space-y-4'>
						{points.map((point) => (
							<li key={point} className='flex items-start gap-3'>
								<span className='mt-0.5 w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center shrink-0'>
									<Check className='w-4 h-4 text-teal-700' aria-hidden='true' />
								</span>
								<span className='text-gray-700'>{point}</span>
							</li>
						))}
					</ul>
				</div>
				<ExampleChat />
			</div>
		</div>
	</section>
);

export default AnswersSection;
