import React, { useEffect, useMemo, useState } from 'react';
import { Search, Calendar, FileText, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { buttonClasses } from '../common';
import { API_BASE_URL as backendUrl } from '../../config';
import { NETWORK_ERROR } from '../../utils/http';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
}

interface SidebarPapersProps {
	selectedPaper: Paper | null;
	onPaperSelect: (paper: Paper) => void;
	// Changing this reloads the list (e.g. after an upload or a delete).
	refreshKey?: number;
	// The phone drawer has its own title bar, so it hides this one.
	showHeading?: boolean;
}

const formatDate = (date: string) =>
	new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// Wraps each match of `term` in <mark>. split() with a capture group puts the
// matches at the odd indexes.
const highlight = (text: string, term: string) => {
	if (!term) return text;
	const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return text.split(new RegExp(`(${escaped})`, 'i')).map((part, i) =>
		i % 2 === 1 ? (
			<mark key={i} className='rounded-sm bg-amber-100 text-inherit'>
				{part}
			</mark>
		) : (
			part
		)
	);
};

const SidebarPapers: React.FC<SidebarPapersProps> = ({
	selectedPaper,
	onPaperSelect,
	refreshKey = 0,
	showHeading = true,
}) => {
	const [papers, setPapers] = useState<Paper[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const [error, setError] = useState('');
	const [retryKey, setRetryKey] = useState(0);
	const [searchTerm, setSearchTerm] = useState('');

	useEffect(() => {
		let ignore = false;
		setStatus((s) => (s === 'ready' ? s : 'loading'));
		(async () => {
			try {
				const res = await fetch(`${backendUrl}/paper/user-papers`, { credentials: 'include' });
				if (!res.ok) {
					throw new Error(
						res.status === 401 ? 'Your session has expired. Please log in again.' : 'Couldn’t load your papers.'
					);
				}
				const data: Paper[] = await res.json();
				if (ignore) return;
				setPapers(data);
				setStatus('ready');
			} catch (err) {
				if (ignore) return;
				setError(err instanceof TypeError ? NETWORK_ERROR : (err as Error).message);
				setStatus('error');
			}
		})();
		return () => {
			ignore = true;
		};
	}, [refreshKey, retryKey]);

	const filtered = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return papers;
		return papers.filter(
			(p) =>
				p.title?.toLowerCase().includes(term) ||
				p.authors?.some((a) => a.toLowerCase().includes(term)) ||
				p.filename?.toLowerCase().includes(term)
		);
	}, [papers, searchTerm]);

	const term = searchTerm.trim();

	return (
		<div className='flex flex-col gap-3 p-4'>
			{showHeading && (
				<div className='flex items-baseline justify-between'>
					<h2 className='text-base font-semibold text-gray-900'>Your papers</h2>
					{status === 'ready' && papers.length > 0 && (
						<span className='text-sm text-gray-500'>{papers.length}</span>
					)}
				</div>
			)}

			{papers.length > 0 && (
				<div className='relative'>
					<Search
						className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400'
						aria-hidden='true'
					/>
					<input
						type='search'
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						placeholder='Search title, author or file'
						aria-label='Search your papers'
						className='w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500'
					/>
				</div>
			)}
			{term && papers.length > 0 && (
				<p className='text-xs text-gray-500' aria-live='polite'>
					{filtered.length} of {papers.length} papers match
				</p>
			)}

			{status === 'loading' && (
				<ul className='space-y-2' aria-label='Loading your papers'>
					{[0, 1, 2].map((i) => (
						<li key={i} className='h-20 animate-pulse rounded-xl bg-gray-100' />
					))}
				</ul>
			)}

			{status === 'error' && (
				<div role='alert' className='rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800'>
					<p className='flex items-start gap-2'>
						<AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
						{error}
					</p>
					<button
						type='button'
						onClick={() => setRetryKey((k) => k + 1)}
						className={buttonClasses('outline', 'sm', 'mt-3')}
					>
						Try again
					</button>
				</div>
			)}

			{status === 'ready' && papers.length === 0 && (
				<div className='rounded-xl border border-dashed border-gray-300 p-6 text-center'>
					<FileText className='mx-auto mb-2 h-8 w-8 text-gray-400' aria-hidden='true' />
					<p className='font-medium text-gray-900'>No papers yet</p>
					<p className='mt-1 text-sm text-gray-600'>Use Upload PDF at the top to add your first paper.</p>
				</div>
			)}

			{status === 'ready' && papers.length > 0 && filtered.length === 0 && (
				<div className='rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-600'>
					<p>No papers match “{term}”.</p>
					<button
						type='button'
						onClick={() => setSearchTerm('')}
						className={buttonClasses('ghost', 'sm', 'mt-2')}
					>
						<X className='h-4 w-4' aria-hidden='true' />
						Clear search
					</button>
				</div>
			)}

			{status === 'ready' && filtered.length > 0 && (
				<ul className='space-y-2' aria-label='Your papers'>
					{filtered.map((paper) => {
						const selected = selectedPaper?._id === paper._id;
						return (
							<li key={paper._id}>
								<button
									type='button'
									onClick={() => onPaperSelect(paper)}
									aria-current={selected ? 'true' : undefined}
									className={clsx(
										'w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
										selected
											? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
											: 'border-gray-200 bg-white hover:border-teal-300 hover:bg-gray-50'
									)}
								>
									<span className='block text-sm font-semibold leading-snug text-gray-900 line-clamp-2'>
										{highlight(paper.title, term)}
									</span>
									<span className='mt-1 block truncate text-sm text-gray-600'>
										{paper.authors?.length ? highlight(paper.authors.join(', '), term) : 'Unknown author'}
									</span>
									<span className='mt-1.5 flex items-center gap-1.5 text-xs text-gray-500'>
										<Calendar className='h-3.5 w-3.5' aria-hidden='true' />
										Uploaded {formatDate(paper.createdAt)}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};

export default SidebarPapers;
