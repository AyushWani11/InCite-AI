import React, { useState, useEffect } from 'react';
import {
	FileText,
	Download,
	Star,
	X,
	Copy,
	CheckCircle,
	Trash2,
} from 'lucide-react';

const backendUrl =
	process.env.NODE_ENV === 'production'
		? process.env.BACKEND_URL || 'https://incite-ai-4vrv.onrender.com/api'
		: 'https://incite-ai-4vrv.onrender.com/api';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
}

interface SummaryType {
	[key: string]: any;
}

interface AssessmentType {
	score: {
		writingQuality: string;
		methodology: string;
		academicStandards: string;
		overallScore: number;
	};
	feedback: {
		writing: string;
		methodology: string;
		standards: string;
	};
	improvementSuggestions: string[];
	issues: string[];
	'X-Factor': string;
}

interface PaperViewerProps {
	paper: Paper;
	onClose: () => void;
}

const SummaryIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<rect x='3' y='3' width='18' height='18' rx='2' />
		<path d='M9 9h6M9 13h6M9 17h4' />
	</svg>
);

const ContributionIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<circle cx='12' cy='12' r='3' />
		<path d='M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24' />
	</svg>
);

const MethodIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<path d='M12 2L2 7l10 5 10-5-10-5z' />
		<path d='M2 17l10 5 10-5M2 12l10 5 10-5' />
	</svg>
);

const ResultIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<path d='M3 3v18h18' />
		<path d='M18 17l-5-5-5 5' />
	</svg>
);

const ConclusionIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<polyline points='20 6 9 17 4 12' />
	</svg>
);

const LimitationIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<circle cx='12' cy='12' r='10' />
		<path d='M15 9l-6 6M9 9l6 6' />
	</svg>
);

const FutureIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<path d='M5 12l5 5L20 7' />
		<path d='M13 12l7-7' />
	</svg>
);

const DefaultIcon = ({ className = 'w-5 h-5' }) => (
	<svg
		className={className}
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
	>
		<circle cx='12' cy='12' r='2' />
		<path d='M12 2v4M12 18v4M4 12h4M16 12h4' />
	</svg>
);

// Modal Component
interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
	if (!isOpen) return null;

	return (
		<div className='fixed inset-0 bg-black/20 bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-lg'>
			<div className='bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-gray-200'>
				<div className='flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'>
					<div className='flex items-center space-x-3'>
						<div className='w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center'>
							<FileText className='w-4 h-4 text-blue-600' />
						</div>
						<h2 className='text-xl font-semibold text-gray-800'>{title}</h2>
					</div>
					<button
						onClick={onClose}
						className='p-2 text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200'
					>
						<X className='w-5 h-5' />
					</button>
				</div>
				<div className='flex-1 overflow-auto p-6 bg-gray-50'>{children}</div>
			</div>
		</div>
	);
};

// Summary Display Component
const SummaryDisplay: React.FC<{ summary: SummaryType }> = ({ summary }) => {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const formatSectionTitle = (key: string) => {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	};

	const renderContent = (key: string, value: any) => {
		// Handle contributions specifically
		if (key.toLowerCase().includes('contribution') && Array.isArray(value)) {
			return (
				<div className='space-y-3'>
					{value.map((contribution, index) => (
						<div
							key={index}
							className='flex items-start space-x-3 p-3 bg-white rounded-lg border border-gray-200'
						>
							<div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium mt-0.5'>
								{index + 1}
							</div>
							<div className='flex-1 text-gray-700 leading-relaxed'>
								{typeof contribution === 'string'
									? contribution.replace(/^["']|["']$/g, '')
									: String(contribution)}
							</div>
						</div>
					))}
				</div>
			);
		}

		// Handle other arrays (like key points, findings, etc.)
		if (Array.isArray(value)) {
			return (
				<div className='space-y-2'>
					{value.map((item, index) => (
						<div key={index} className='flex items-start space-x-2'>
							<div className='w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0'></div>
							<div className='text-gray-700 leading-relaxed'>
								{typeof item === 'string'
									? item.replace(/^["']|["']$/g, '')
									: String(item)}
							</div>
						</div>
					))}
				</div>
			);
		}

		// Handle objects
		if (typeof value === 'object' && value !== null) {
			return (
				<div className='bg-white rounded-lg border border-gray-200 p-4'>
					<pre className='text-sm text-gray-600 whitespace-pre-wrap font-mono'>
						{JSON.stringify(value, null, 2)}
					</pre>
				</div>
			);
		}

		// Handle strings and other primitives
		const stringValue = String(value).replace(/^["']|["']$/g, '');
		return (
			<div className='text-gray-700 leading-relaxed whitespace-pre-wrap'>
				{stringValue}
			</div>
		);
	};

	const getSectionIcon = (key: string) => {
		const lowerKey = key.toLowerCase();

		if (lowerKey.includes('contribution')) {
			return <ContributionIcon className='w-5 h-5 text-blue-600' />;
		}
		if (lowerKey.includes('abstract') || lowerKey.includes('summary')) {
			return <SummaryIcon className='w-5 h-5 text-indigo-600' />;
		}
		if (lowerKey.includes('method') || lowerKey.includes('approach')) {
			return <MethodIcon className='w-5 h-5 text-purple-600' />;
		}
		if (lowerKey.includes('result') || lowerKey.includes('finding')) {
			return <ResultIcon className='w-5 h-5 text-green-600' />;
		}
		if (lowerKey.includes('conclusion')) {
			return <ConclusionIcon className='w-5 h-5 text-teal-600' />;
		}
		if (lowerKey.includes('limitation')) {
			return <LimitationIcon className='w-5 h-5 text-red-600' />;
		}
		if (lowerKey.includes('future') || lowerKey.includes('recommendation')) {
			return <FutureIcon className='w-5 h-5 text-orange-600' />;
		}

		return <DefaultIcon className='w-5 h-5 text-gray-600' />;
	};

	return (
		<div className='space-y-6'>
			<div className='flex justify-between items-center'>
				<div className='text-sm text-gray-500'>
					Analysis generated • {Object.keys(summary).length} sections
				</div>
				<button
					onClick={copyToClipboard}
					className='flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
				>
					{copied ? (
						<CheckCircle className='w-4 h-4 text-green-600' />
					) : (
						<Copy className='w-4 h-4' />
					)}
					<span>{copied ? 'Copied!' : 'Copy JSON'}</span>
				</button>
			</div>

			{Object.entries(summary).map(([key, value]) => (
				<div
					key={key}
					className='bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200'
				>
					<div className='flex items-center space-x-3 mb-4'>
						<span className='text-xl'>{getSectionIcon(key)}</span>
						<h3 className='text-lg font-semibold text-gray-800'>
							{formatSectionTitle(key)}
						</h3>
						<div className='flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent'></div>
					</div>
					<div className='ml-8'>{renderContent(key, value)}</div>
				</div>
			))}
		</div>
	);
};

// Assessment Display Component
const AssessmentDisplay: React.FC<{ assessment: AssessmentType }> = ({
	assessment,
}) => {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(assessment, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className='space-y-6'>
			<div className='flex justify-end'>
				<button
					onClick={copyToClipboard}
					className='flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
				>
					{copied ? (
						<CheckCircle className='w-4 h-4 text-green-600' />
					) : (
						<Copy className='w-4 h-4' />
					)}
					<span>{copied ? 'Copied!' : 'Copy JSON'}</span>
				</button>
			</div>

			{/* Overall Score */}
			<div className='bg-blue-50 rounded-lg p-4'>
				<h3 className='font-medium text-blue-800 mb-2'>Overall Score</h3>
				<div className='text-2xl font-bold text-blue-600'>
					{assessment.score.overallScore}/100
				</div>
			</div>

			{/* Individual Scores */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-1'>Writing Quality</h4>
					<div className='text-gray-600'>{assessment.score.writingQuality}</div>
				</div>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-1'>Methodology</h4>
					<div className='text-gray-600'>{assessment.score.methodology}</div>
				</div>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-1'>Academic Standards</h4>
					<div className='text-gray-600'>
						{assessment.score.academicStandards}
					</div>
				</div>
			</div>

			{/* Feedback */}
			<div className='space-y-4'>
				<h3 className='font-medium text-gray-800'>Detailed Feedback</h3>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-2'>Writing</h4>
					<p className='text-gray-600'>{assessment.feedback.writing}</p>
				</div>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-2'>Methodology</h4>
					<p className='text-gray-600'>{assessment.feedback.methodology}</p>
				</div>
				<div className='bg-gray-50 rounded-lg p-4'>
					<h4 className='font-medium text-gray-800 mb-2'>Standards</h4>
					<p className='text-gray-600'>{assessment.feedback.standards}</p>
				</div>
			</div>

			{/* Improvement Suggestions */}
			{assessment.improvementSuggestions &&
				assessment.improvementSuggestions.length > 0 && (
					<div className='bg-green-50 rounded-lg p-4'>
						<h3 className='font-medium text-green-800 mb-2'>
							Improvement Suggestions
						</h3>
						<ul className='space-y-1'>
							{assessment.improvementSuggestions.map((suggestion, index) => (
								<li key={index} className='text-green-700 flex items-start'>
									<span className='mr-2'>•</span>
									<span>{suggestion}</span>
								</li>
							))}
						</ul>
					</div>
				)}

			{/* Issues */}
			{assessment.issues && assessment.issues.length > 0 && (
				<div className='bg-red-50 rounded-lg p-4'>
					<h3 className='font-medium text-red-800 mb-2'>Issues Identified</h3>
					<ul className='space-y-1'>
						{assessment.issues.map((issue, index) => (
							<li key={index} className='text-red-700 flex items-start'>
								<span className='mr-2'>•</span>
								<span>{issue}</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* X-Factor */}
			{assessment['X-Factor'] && (
				<div className='bg-purple-50 rounded-lg p-4'>
					<h3 className='font-medium text-purple-800 mb-2'>X-Factor</h3>
					<p className='text-purple-700'>{assessment['X-Factor']}</p>
				</div>
			)}
		</div>
	);
};

const PaperViewer: React.FC<PaperViewerProps> = ({ paper, onClose }) => {
	const [pdfLoading, setPdfLoading] = useState(true);
	const [pdfError, setPdfError] = useState(false);
	const [existingSummary, setExistingSummary] = useState<SummaryType | null>(
		null
	);
	const [existingAssessment, setExistingAssessment] =
		useState<AssessmentType | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisType, setAnalysisType] = useState<string | null>(null);

	// Modal states
	const [showSummaryModal, setShowSummaryModal] = useState(false);
	const [showAssessmentModal, setShowAssessmentModal] = useState(false);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const formatAuthors = (authors?: string[]) => {
		if (!authors || authors.length === 0) return 'Unknown Author';
		if (authors.length === 1) return authors[0];
		if (authors.length === 2) return authors.join(' & ');
		return `${authors[0]} et al.`;
	};

	const pdfUrl = `${backendUrl}/paper/download/${paper.filename}`;

	const handlePdfLoad = () => {
		setPdfLoading(false);
		setPdfError(false);
	};

	const handlePdfError = () => {
		setPdfLoading(false);
		setPdfError(true);
	};

	const handleDelete = async () => {
		if (!window.confirm('Are you sure you want to delete this paper?')) return;
		try {
			const res = await fetch(`${backendUrl}/paper/delete/${paper._id}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Delete failed');
			onClose();
			window.location.reload();
		} catch (err) {
			alert('Failed to delete paper. Please try again.');
		}
	};

	useEffect(() => {
		setPdfLoading(true);
		setPdfError(false);
		setIsAnalyzing(false);
		setAnalysisType(null);
		setExistingSummary(null);
		setExistingAssessment(null);

		fetch(`${backendUrl}/paper/summary/${paper._id}`, {
			method: 'GET',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
		})
			.then(async (res) => {
				if (res.ok) {
					const json = await res.json();
					setExistingSummary(json.summary);
				} else {
					setExistingSummary(null);
				}
			})
			.catch(() => {
				setExistingSummary(null);
			});

		fetch(`${backendUrl}/paper/assessment/${paper._id}`, {
			method: 'GET',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
		})
			.then(async (res) => {
				if (res.ok) {
					const json = await res.json();
					setExistingAssessment(json.assessment);
				} else {
					setExistingAssessment(null);
				}
			})
			.catch(() => {
				setExistingAssessment(null);
			});
	}, [paper._id]);

	const handleAnalysis = async (type: 'summarize' | 'assess') => {
		setIsAnalyzing(true);
		setAnalysisType(type);

		try {
			const endpoint =
				type === 'summarize'
					? `${backendUrl}/paper/summarize/${paper._id}`
					: `${backendUrl}/paper/assess/${paper._id}`;

			const response = await fetch(endpoint, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			if (!response.ok) {
				throw new Error(`Analysis failed: ${response.statusText}`);
			}

			const result = await response.json();

			if (type === 'summarize') {
				setExistingSummary(result.summary);
				setShowSummaryModal(true);
			} else {
				setExistingAssessment(result.assessment);
				setShowAssessmentModal(true);
			}
		} catch (error) {
			alert(`Failed to ${type} paper. Please try again.`);
		} finally {
			setIsAnalyzing(false);
			setAnalysisType(null);
		}
	};

	const viewSummary = () => {
		if (!existingSummary) return;
		setShowSummaryModal(true);
	};

	const viewAssessment = () => {
		if (!existingAssessment) return;
		setShowAssessmentModal(true);
	};

	return (
		<div className='h-full flex flex-col bg-gray-50'>
			<div className='bg-white border-b border-gray-100 shadow-sm'>
				<div className='p-4 border-b border-gray-50'>
					<div className='flex items-center justify-between'>
						<div className='flex-1 min-w-0'>
							<h1 className='text-lg font-semibold text-gray-800 truncate mb-1'>
								{paper.title}
							</h1>
							<div className='flex items-center space-x-4 text-sm text-gray-500'>
								<span>{formatAuthors(paper.authors)}</span>
								<span>•</span>
								<span>{formatDate(paper.createdAt)}</span>
							</div>
						</div>
						<div className='flex items-center space-x-2 ml-4'>
							<a
								href={pdfUrl}
								download
								className='p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all duration-200'
								title='Download PDF'
							>
								<Download className='w-4 h-4' />
							</a>
							<button
								onClick={handleDelete}
								className='cursor-pointer p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-200'
								title='Delete Paper'
							>
								<Trash2 className='w-4 h-4' />
							</button>

							<button
								onClick={onClose}
								className='cursor-pointer p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all duration-200'
								title='Close paper'
							>
								<X className='w-4 h-4' />
							</button>
						</div>
					</div>
				</div>
				<div className='p-4'>
					<div className='flex items-center space-x-3'>
						{existingSummary ? (
							<button
								onClick={viewSummary}
								className='cursor-pointer flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-teal-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 font-medium text-sm shadow-sm'
							>
								<FileText className='w-4 h-4' />
								<span>View Summary</span>
							</button>
						) : (
							<button
								onClick={() => handleAnalysis('summarize')}
								disabled={isAnalyzing}
								className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
									isAnalyzing && analysisType === 'summarize'
										? 'bg-teal-100 text-teal-700 cursor-not-allowed'
										: 'bg-teal-500 text-white hover:bg-teal-600 hover:shadow-md shadow-sm'
								}`}
							>
								{isAnalyzing && analysisType === 'summarize' ? (
									<>
										<div className='animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent'></div>
										<span>Summarizing...</span>
									</>
								) : (
									<>
										<FileText className='w-4 h-4' />
										<span>Summarize Paper</span>
									</>
								)}
							</button>
						)}
						{existingAssessment ? (
							<button
								onClick={viewAssessment}
								className='cursor-pointer flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-teal-100 transition-all duration-200 font-medium text-sm shadow-sm'
							>
								<Star className='w-4 h-4' />
								<span>View Assessment</span>
							</button>
						) : (
							<button
								onClick={() => handleAnalysis('assess')}
								disabled={isAnalyzing}
								className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
									isAnalyzing && analysisType === 'assess'
										? 'bg-blue-100 text-blue-700 cursor-not-allowed'
										: 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md shadow-sm'
								}`}
							>
								{isAnalyzing && analysisType === 'assess' ? (
									<>
										<div className='animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent'></div>
										<span>Assessing...</span>
									</>
								) : (
									<>
										<Star className='w-4 h-4' />
										<span>Assess Paper</span>
									</>
								)}
							</button>
						)}
						{isAnalyzing && (
							<div className='flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg'>
								<div className='animate-pulse w-2 h-2 bg-gray-400 rounded-full'></div>
								<span>AI Analysis in progress...</span>
							</div>
						)}
					</div>
				</div>
			</div>
			<div className='flex-1 relative overflow-hidden bg-white'>
				{pdfLoading && (
					<div className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white'>
						<div className='text-center bg-white p-8 rounded-xl shadow-sm border border-gray-100'>
							<div className='animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-teal-500 mx-auto mb-4'></div>
							<p className='text-gray-500 font-medium'>Loading PDF...</p>
							<p className='text-xs text-gray-400 mt-1'>Please wait a moment</p>
						</div>
					</div>
				)}
				{pdfError && (
					<div className='absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white'>
						<div className='text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-100'>
							<div className='w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
								<FileText className='w-10 h-10 text-gray-300' />
							</div>
							<h3 className='text-lg font-medium text-gray-700 mb-2'>
								Unable to load PDF
							</h3>
							<p className='text-gray-500 mb-6 text-sm leading-relaxed'>
								The PDF file could not be displayed in the browser. You can
								download it to view on your device.
							</p>
							<div className='flex justify-center space-x-3'>
								<button
									onClick={() => {
										setPdfLoading(true);
										setPdfError(false);
									}}
									className='px-5 py-2.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md'
								>
									Try Again
								</button>
								<a
									href={pdfUrl}
									download
									className='px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium text-sm border border-gray-200 hover:border-gray-300'
								>
									Download PDF
								</a>
							</div>
						</div>
					</div>
				)}
				{paper.filename && (
					<iframe
						src={pdfUrl}
						title={`PDF viewer for ${paper.title}`}
						className='w-full h-full border-0'
						onLoad={handlePdfLoad}
						onError={handlePdfError}
						style={{
							display: pdfLoading || pdfError ? 'none' : 'block',
						}}
					/>
				)}
				<noscript>
					<div className='p-8 text-center bg-white'>
						<div className='w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
							<FileText className='w-10 h-10 text-gray-300' />
						</div>
						<p className='text-gray-500 mb-6'>
							Your browser doesn't support inline PDF viewing.
						</p>
						<a
							href={pdfUrl}
							target='_blank'
							rel='noopener noreferrer'
							className='inline-flex items-center px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-200 font-medium shadow-sm hover:shadow-md'
						>
							<Download className='w-4 h-4 mr-2' />
							Download PDF
						</a>
					</div>
				</noscript>
			</div>

			{/* Modals */}
			<Modal
				isOpen={showSummaryModal}
				onClose={() => setShowSummaryModal(false)}
				title='Paper Summary'
			>
				{existingSummary && <SummaryDisplay summary={existingSummary} />}
			</Modal>

			<Modal
				isOpen={showAssessmentModal}
				onClose={() => setShowAssessmentModal(false)}
				title='Paper Assessment'
			>
				{existingAssessment && (
					<AssessmentDisplay assessment={existingAssessment} />
				)}
			</Modal>
		</div>
	);
};

export default PaperViewer;
