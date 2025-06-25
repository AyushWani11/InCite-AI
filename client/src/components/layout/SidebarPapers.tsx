import React, { useEffect, useState, useMemo } from 'react';
import { Search, Calendar } from 'lucide-react';
import './SidebarPapers.css';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
	userId?: string; // Add userId to track paper ownership
}

interface SidebarPapersProps {
	selectedPaper: Paper | null;
	onPaperSelect: (paper: Paper) => void;
}

const backendUrl =
	process.env.NODE_ENV === 'production'
		? process.env.BACKEND_URL
		: 'https://incite-ai-4vrv.onrender.com/api';

const SidebarPapers: React.FC<SidebarPapersProps> = ({
	selectedPaper,
	onPaperSelect,
}) => {
	const [papers, setPapers] = useState<Paper[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const [searchTerm, setSearchTerm] = useState('');
	// const [startDate, setStartDate] = useState('');
	// const [endDate, setEndDate] = useState('');
	// const [isOpen, setIsOpen] = useState(true);
	// const toggleSidebar = () => setIsOpen((prev) => !prev);
	useEffect(() => {
		const fetchUserPapers = async () => {
			setLoading(true);
			try {
				// Fetch papers for the current authenticated user
				const res = await fetch(`${backendUrl}/paper/user-papers`, {
					method: 'GET',
					credentials: 'include', // Include cookies for authentication
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (!res.ok) {
					throw new Error(`Failed to fetch papers: ${res.status}`);
				}

				const data: Paper[] = await res.json();
				setPapers(data);
			} catch (err) {
				console.error('Error fetching user papers:', err);
				setError('Failed to load your papers. Please try again.');
			} finally {
				setLoading(false);
			}
		};

		fetchUserPapers();
	}, []);

	const filteredPapers = useMemo(() => {
		return papers.filter((paper) => {
			const matchesSearch =
				searchTerm === '' ||
				paper.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(paper.authors &&
					paper.authors.some((author) =>
						author.toLowerCase().includes(searchTerm.toLowerCase())
					)) ||
				(paper.filename &&
					paper.filename.toLowerCase().includes(searchTerm.toLowerCase()));

			// const paperDate = new Date(paper.createdAt);
			// const start = startDate ? new Date(startDate) : null;
			// const end = endDate ? new Date(endDate + 'T23:59:59') : null;

			// const matchesDateRange =
			// 	(!start || paperDate >= start) && (!end || paperDate <= end);

			return matchesSearch;
		});
	}, [papers, searchTerm]);

	const highlightText = (text: string, term: string) => {
		if (!term || !text) return text;
		const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escaped})`, 'gi');
		return text.split(regex).map((part, i) =>
			regex.test(part) ? (
				<span key={i} className='highlight'>
					{part}
				</span>
			) : (
				part
			)
		);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	// const clearFilters = () => {
	// 	setSearchTerm('');
	// 	setStartDate('');
	// 	setEndDate('');
	// };

	return (
		<>
			<aside className='sidebar-papers'>
				<h3 className='sidebar-title'>Your Uploaded Papers</h3>

				<div className='filters-section'>
					<div className='search-container'>
						<Search className='search-icon' size={16} />
						<input
							type='text'
							className='search-input'
							placeholder='Search by title, author, or filename...'
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					<div className='papers-count'>
						Showing {filteredPapers.length} of {papers.length} papers
					</div>
				</div>

				{error && <div className='error-message'>{error}</div>}
				{loading && (
					<div className='loading-message'>Loading your papers...</div>
				)}

				{papers.length === 0 && !loading ? (
					<div className='no-papers'>
						No papers uploaded yet.
						<br />
						<small>Upload your first research paper to get started!</small>
					</div>
				) : filteredPapers.length === 0 && !loading ? (
					<div className='no-results'>
						No papers match your current filters.
						<br />
						<small>Try adjusting your search range.</small>
					</div>
				) : (
					<div className='papers-container'>
						{filteredPapers.map((paper) => (
							<div
								key={paper._id}
								className={`paper-card cursor-pointer ${
									selectedPaper?._id === paper._id ? 'selected-card' : ''
								}`}
								onClick={() => onPaperSelect(paper)}
							>
								<div className='paper-info'>
									<h4 className='paper-title'>
										{highlightText(paper.title, searchTerm)}
									</h4>
									<p className='paper-authors'>
										{paper.authors?.length
											? highlightText(paper.authors.join(', '), searchTerm)
											: 'Unknown Author'}
									</p>
									<p className='paper-date'>
										<Calendar size={14} className='inline mr-1' />
										Uploaded: {formatDate(paper.createdAt)}
									</p>
								</div>
							</div>
						))}
					</div>
				)}
			</aside>
		</>
	);
};

export default SidebarPapers;
