import React from 'react';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import { Logo } from '../common';

const REPO_URL = 'https://github.com/AyushWani11/InCite-AI';

const linkClass =
	'text-sm text-gray-300 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';

const Footer: React.FC = () => (
	<footer className='bg-gray-900 text-white'>
		<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'>
			<div className='flex flex-col md:flex-row md:items-start md:justify-between gap-8'>
				<div className='space-y-4 max-w-sm'>
					<Logo tone='light' />
					<p className='text-sm text-gray-300 leading-relaxed'>
						Upload research papers, ask questions about them, and get summaries and assessments, with
						sources for every answer.
					</p>
				</div>

				<nav aria-label='Footer' className='flex flex-wrap gap-x-8 gap-y-3'>
					<a href='#features' className={linkClass}>
						Features
					</a>
					<a href='#how-it-works' className={linkClass}>
						How it works
					</a>
					<Link to='/login' className={linkClass}>
						Log in
					</Link>
					<Link to='/signup' className={linkClass}>
						Sign up
					</Link>
					<a href={REPO_URL} target='_blank' rel='noreferrer' className={`${linkClass} inline-flex items-center gap-1.5`}>
						<Github className='w-4 h-4' aria-hidden='true' />
						Source code
					</a>
				</nav>
			</div>

			<div className='border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm text-gray-400'>
				<p>© {new Date().getFullYear()} InCite AI</p>
				<p>Built with React, Express, MongoDB, Pinecone and Google Gemini.</p>
			</div>
		</div>
	</footer>
);

export default Footer;
