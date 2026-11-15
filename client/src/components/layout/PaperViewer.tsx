import React, { useEffect, useState } from 'react';
import {
	FileText,
	Download,
	ExternalLink,
	ClipboardCheck,
	X,
	Copy,
	Check,
	Trash2,
	Loader2,
	RefreshCw,
	AlertCircle,
	AlignLeft,
	Lightbulb,
	FlaskConical,
	ChartColumn,
	Flag,
	CircleDot,
	TriangleAlert,
	Sparkles,
	type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Modal, buttonClasses } from '../common';
import RichText from '../common/RichText';
import { API_BASE_URL as backendUrl } from '../../config';
import { NETWORK_ERROR, readError } from '../../utils/http';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
}

// Field names match the server's schemas (server/utils/schemas.js). Older
// saved results may have other fields, so both views render unknown ones too.
type Summary = Record<string, unknown>;

interface Assessment {
	score?: {
		writingQuality?: string;
		methodology?: string;
		academicStandards?: string;
		overallScore?: number;
	};
	feedback?: { writing?: string; methodology?: string; standards?: string };
	improvementSuggestions?: string[];
	issues?: string[];
	'X-Factor'?: string;
}

type Kind = 'summary' | 'assessment';

interface PaperViewerProps {
	paper: Paper;
	onClose: () => void;
	onDeleted: () => void;
}

const SUMMARY_SECTIONS: Record<string, { title: string; icon: LucideIcon }> = {
	summary: { title: 'Summary', icon: AlignLeft },
	contributions: { title: 'Key contributions', icon: Lightbulb },
	methodology: { title: 'Methodology', icon: FlaskConical },
	findings: { title: 'Findings', icon: ChartColumn },
	conclusion: { title: 'Conclusion', icon: Flag },
};

// Known sections first, in a sensible reading order, then anything else.
const summaryKeys = (summary: Summary) => [
	...Object.keys(SUMMARY_SECTIONS).filter((k) => k in summary),
	...Object.keys(summary).filter((k) => !(k in SUMMARY_SECTIONS)),
];
const sectionTitle = (key: string) =>
	SUMMARY_SECTIONS[key]?.title ??
	key
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (c) => c.toUpperCase())
		.trim();
const unquote = (text: string) => text.replace(/^["']|["']$/g, '');
const plain = (value: unknown) =>
	Array.isArray(value)
		? value.map((item, i) => `${i + 1}. ${unquote(String(item))}`).join('\n')
		: value && typeof value === 'object'
			? JSON.stringify(value, null, 2)
			: unquote(String(value ?? ''));

const summaryAsText = (summary: Summary) =>
	summaryKeys(summary)
		.map((key) => `${sectionTitle(key)}\n${plain(summary[key])}`)
		.join('\n\n');

const assessmentAsText = (a: Assessment) =>
	[
		`Overall score: ${a.score?.overallScore ?? '?'}/100`,
		`Writing quality: ${a.score?.writingQuality ?? '?'}`,
		`Methodology: ${a.score?.methodology ?? '?'}`,
		`Academic standards: ${a.score?.academicStandards ?? '?'}`,
		'',
		'Feedback',
		`Writing: ${a.feedback?.writing ?? ''}`,
		`Methodology: ${a.feedback?.methodology ?? ''}`,
		`Academic standards: ${a.feedback?.standards ?? ''}`,
		'',
		'Suggestions',
		plain(a.improvementSuggestions ?? []),
		'',
		'Issues',
		a.issues?.length ? plain(a.issues) : 'None found.',
		'',
		'What stands out',
		a['X-Factor'] ?? '',
	].join('\n');

const formatDate = (date: string) =>
	new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const formatAuthors = (authors?: string[]) => {
	if (!authors || authors.length === 0) return 'Unknown author';
	if (authors.length === 1) return authors[0];
	if (authors.length === 2) return authors.join(' & ');
	return `${authors[0]} et al.`;
};

const Value: React.FC<{ value: unknown; numbered?: boolean }> = ({ value, numbered }) => {
	if (Array.isArray(value)) {
		const List = numbered ? 'ol' : 'ul';
		return (
			<List
				className={clsx(
					'space-y-2 pl-5 leading-relaxed text-gray-700 marker:text-teal-700',
					numbered ? 'list-decimal' : 'list-disc'
				)}
			>
				{value.map((item, i) => (
					<li key={i} className='pl-1'>
						<RichText inline text={unquote(String(item))} />
					</li>
				))}
			</List>
		);
	}
	if (value && typeof value === 'object') {
		return (
			<pre className='whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-mono text-sm text-gray-700'>
				{JSON.stringify(value, null, 2)}
			</pre>
		);
	}
	// Model-written text: markdown and LaTeX math (e.g. $\mu_E$) are rendered.
	return <RichText text={unquote(String(value ?? ''))} className='leading-relaxed text-gray-700' />;
};

const Card: React.FC<{ title: string; icon: LucideIcon; children: React.ReactNode }> = ({
	title,
	icon: Icon,
	children,
}) => (
	<section className='rounded-xl border border-gray-200 bg-white p-5'>
		<h3 className='mb-3 flex items-center gap-2 text-base font-semibold text-gray-900'>
			<Icon className='h-5 w-5 text-teal-700' aria-hidden='true' />
			{title}
		</h3>
		{children}
	</section>
);

const SummaryView: React.FC<{ summary: Summary }> = ({ summary }) => (
	<div className='space-y-4'>
		{summaryKeys(summary).map((key) => (
			<Card key={key} title={sectionTitle(key)} icon={SUMMARY_SECTIONS[key]?.icon ?? CircleDot}>
				<Value value={summary[key]} numbered={key === 'contributions'} />
			</Card>
		))}
	</div>
);

// The rating is written out as well as coloured, so colour is never the only cue.
const RATING_STYLES: Record<string, string> = {
	Excellent: 'border-teal-200 bg-teal-50 text-teal-800',
	Good: 'border-sky-200 bg-sky-50 text-sky-800',
	Average: 'border-amber-200 bg-amber-50 text-amber-800',
	Poor: 'border-red-200 bg-red-50 text-red-800',
};
const scoreBarColor = (score: number) =>
	score >= 80 ? 'bg-teal-600' : score >= 60 ? 'bg-sky-600' : score >= 40 ? 'bg-amber-500' : 'bg-red-600';

const AssessmentView: React.FC<{ assessment: Assessment }> = ({ assessment }) => {
	const score = Math.max(0, Math.min(100, assessment.score?.overallScore ?? 0));
	const ratings = [
		['Writing quality', assessment.score?.writingQuality],
		['Methodology', assessment.score?.methodology],
		['Academic standards', assessment.score?.academicStandards],
	] as const;
	const feedback = [
		['Writing', assessment.feedback?.writing],
		['Methodology', assessment.feedback?.methodology],
		['Academic standards', assessment.feedback?.standards],
	] as const;

	return (
		<div className='space-y-4'>
			<section className='rounded-xl border border-gray-200 bg-white p-5'>
				<h3 className='text-sm font-medium text-gray-500'>Overall score</h3>
				<p className='text-4xl font-bold text-gray-900'>
					{score}
					<span className='text-lg font-medium text-gray-500'>/100</span>
				</p>
				<div className='mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100' aria-hidden='true'>
					<div className={clsx('h-full rounded-full', scoreBarColor(score))} style={{ width: `${score}%` }} />
				</div>
				<dl className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3'>
					{ratings.map(([label, rating]) => (
						<div key={label} className='rounded-lg border border-gray-200 px-4 py-3'>
							<dt className='text-sm text-gray-500'>{label}</dt>
							<dd className='mt-1'>
								<span
									className={clsx(
										'inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium',
										RATING_STYLES[rating ?? ''] ?? 'border-gray-200 bg-gray-50 text-gray-700'
									)}
								>
									{rating ?? 'Not rated'}
								</span>
							</dd>
						</div>
					))}
				</dl>
			</section>

			<Card title='Feedback' icon={AlignLeft}>
				<div className='space-y-4'>
					{feedback.map(([label, text]) => (
						<div key={label}>
							<h4 className='text-sm font-semibold text-gray-800'>{label}</h4>
							<RichText text={text || '—'} className='mt-1 leading-relaxed text-gray-700' />
						</div>
					))}
				</div>
			</Card>

			{!!assessment.improvementSuggestions?.length && (
				<Card title='Suggestions' icon={Lightbulb}>
					<Value value={assessment.improvementSuggestions} />
				</Card>
			)}

			<Card title='Issues found' icon={TriangleAlert}>
				{assessment.issues?.length ? (
					<Value value={assessment.issues} />
				) : (
					<p className='text-gray-700'>No issues found.</p>
				)}
			</Card>

			{assessment['X-Factor'] && (
				<Card title='What stands out' icon={Sparkles}>
					<Value value={assessment['X-Factor']} />
				</Card>
			)}
		</div>
	);
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard blocked (e.g. not HTTPS): nothing useful to do.
		}
	};
	return (
		<button type='button' onClick={copy} className={buttonClasses('ghost', 'sm')}>
			{copied ? <Check className='h-4 w-4 text-teal-700' aria-hidden='true' /> : <Copy className='h-4 w-4' aria-hidden='true' />}
			<span aria-live='polite'>{copied ? 'Copied' : 'Copy as text'}</span>
		</button>
	);
};

const iconButton =
	'p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const PaperViewer: React.FC<PaperViewerProps> = ({ paper, onClose, onDeleted }) => {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [assessment, setAssessment] = useState<Assessment | null>(null);
	const [busy, setBusy] = useState<Kind | null>(null);
	const [analysisError, setAnalysisError] = useState('');
	const [openModal, setOpenModal] = useState<Kind | null>(null);
	const [pdfState, setPdfState] = useState<'loading' | 'ready' | 'error'>(paper.filename ? 'loading' : 'error');
	const [iframeKey, setIframeKey] = useState(0);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState('');

	// Requires the login cookie; the server checks that this paper is yours.
	const pdfUrl = `${backendUrl}/paper/download/${paper._id}`;

	// Load a summary and assessment saved earlier, if there are any. (The
	// dashboard gives each paper a fresh PaperViewer, so state starts empty.)
	useEffect(() => {
		let ignore = false;
		const load = async (path: string, field: string) => {
			try {
				const res = await fetch(`${backendUrl}/paper/${path}/${paper._id}`, { credentials: 'include' });
				return res.ok ? (await res.json())[field] : null;
			} catch {
				return null;
			}
		};
		load('summary', 'summary').then((s) => !ignore && s && setSummary(s));
		load('assessment', 'assessment').then((a) => !ignore && a && setAssessment(a));
		return () => {
			ignore = true;
		};
	}, [paper._id]);

	const generate = async (kind: Kind) => {
		setBusy(kind);
		setAnalysisError('');
		try {
			const res = await fetch(`${backendUrl}/paper/${kind === 'summary' ? 'summarize' : 'assess'}/${paper._id}`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!res.ok) {
				// e.g. a 502 when the AI's reply was unusable even after a retry.
				setAnalysisError(await readError(res, `Couldn't create the ${kind}. Please try again.`));
				return;
			}
			const data = await res.json();
			if (kind === 'summary') setSummary(data.summary);
			else setAssessment(data.assessment);
			setOpenModal(kind);
		} catch {
			setAnalysisError(NETWORK_ERROR);
		} finally {
			setBusy(null);
		}
	};

	const handleDelete = async () => {
		setDeleting(true);
		setDeleteError('');
		try {
			const res = await fetch(`${backendUrl}/paper/delete/${paper._id}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) {
				setDeleteError(await readError(res, 'Couldn’t delete the paper. Please try again.'));
				return;
			}
			onDeleted();
		} catch {
			setDeleteError(NETWORK_ERROR);
		} finally {
			setDeleting(false);
		}
	};

	const closeModal = () => {
		setOpenModal(null);
		setAnalysisError('');
	};

	const analysisButton = (kind: Kind) => {
		const saved = kind === 'summary' ? summary : assessment;
		const Icon = kind === 'summary' ? FileText : ClipboardCheck;
		const working = busy === kind;
		const label = working
			? kind === 'summary'
				? 'Summarizing…'
				: 'Assessing…'
			: saved
				? `View ${kind}`
				: kind === 'summary'
					? 'Summarize paper'
					: 'Assess paper';
		return (
			<button
				type='button'
				onClick={() => (saved ? setOpenModal(kind) : generate(kind))}
				disabled={!saved && busy !== null}
				className={buttonClasses(saved ? 'outline' : 'primary', 'md')}
			>
				{working ? (
					<Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
				) : (
					<Icon className='h-4 w-4' aria-hidden='true' />
				)}
				{label}
			</button>
		);
	};

	const modalFooter = (kind: Kind, text: string) => (
		<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
			{analysisError ? (
				<p role='alert' className='text-sm text-red-600'>
					{analysisError}
				</p>
			) : (
				<p className='text-sm text-gray-500'>
					{busy === kind
						? 'Writing a new version from the whole paper…'
						: 'Written by AI. Check important details against the paper.'}
				</p>
			)}
			<div className='flex shrink-0 gap-2'>
				<CopyButton text={text} />
				<button
					type='button'
					onClick={() => generate(kind)}
					disabled={busy !== null}
					className={buttonClasses('outline', 'sm')}
				>
					{busy === kind ? (
						<Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
					) : (
						<RefreshCw className='h-4 w-4' aria-hidden='true' />
					)}
					Regenerate
				</button>
			</div>
		</div>
	);

	return (
		<div className='h-full flex flex-col bg-white'>
			<div className='border-b border-gray-200'>
				<div className='flex items-start justify-between gap-3 px-4 pt-3 sm:px-5'>
					<div className='min-w-0'>
						<h2 className='truncate text-base font-semibold text-gray-900 sm:text-lg' title={paper.title}>
							{paper.title}
						</h2>
						<p className='truncate text-sm text-gray-500'>
							{formatAuthors(paper.authors)} · {formatDate(paper.createdAt)}
						</p>
					</div>
					<div className='-mr-2 flex shrink-0 items-center'>
						<a href={pdfUrl} target='_blank' rel='noreferrer' aria-label='Open the PDF in a new tab' title='Open in a new tab' className={iconButton}>
							<ExternalLink className='h-5 w-5' />
						</a>
						<a href={pdfUrl} download aria-label='Download the PDF' title='Download' className={iconButton}>
							<Download className='h-5 w-5' />
						</a>
						<button
							type='button'
							onClick={() => {
								setConfirmDelete(true);
								setDeleteError('');
							}}
							aria-label='Delete this paper'
							title='Delete'
							className={clsx(iconButton, 'hover:bg-red-50 hover:text-red-600')}
						>
							<Trash2 className='h-5 w-5' />
						</button>
						<button type='button' onClick={onClose} aria-label='Close the paper' title='Close' className={iconButton}>
							<X className='h-5 w-5' />
						</button>
					</div>
				</div>

				{confirmDelete && (
					<div role='alertdialog' aria-label='Delete this paper?' className='mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3 sm:mx-5'>
						<p className='text-sm text-red-900'>
							Delete this paper? Its PDF, summary, assessment and search index will be removed. This can’t be
							undone.
						</p>
						{deleteError && (
							<p role='alert' className='mt-1 text-sm font-medium text-red-700'>
								{deleteError}
							</p>
						)}
						<div className='mt-3 flex justify-end gap-2'>
							<button
								type='button'
								autoFocus
								onClick={() => setConfirmDelete(false)}
								disabled={deleting}
								className={buttonClasses('outline', 'sm')}
							>
								Cancel
							</button>
							<button type='button' onClick={handleDelete} disabled={deleting} className={buttonClasses('danger', 'sm')}>
								{deleting ? (
									<Loader2 className='h-4 w-4 animate-spin' aria-hidden='true' />
								) : (
									<Trash2 className='h-4 w-4' aria-hidden='true' />
								)}
								{deleting ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				)}

				<div className='flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5'>
					{analysisButton('summary')}
					{analysisButton('assessment')}
					{busy && !openModal && (
						<p className='text-sm text-gray-500' aria-live='polite'>
							Reading the whole paper. Long papers can take a minute.
						</p>
					)}
				</div>
				{analysisError && !openModal && (
					<p role='alert' className='flex items-start gap-2 px-4 pb-3 text-sm text-red-600 sm:px-5'>
						<AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
						{analysisError}
					</p>
				)}
			</div>

			<div className='relative min-h-0 flex-1 bg-gray-100'>
				{pdfState === 'loading' && (
					<div className='absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500'>
						<Loader2 className='h-8 w-8 animate-spin text-teal-600' aria-hidden='true' />
						<p>Loading PDF…</p>
					</div>
				)}
				{pdfState === 'error' && (
					<div className='absolute inset-0 flex items-center justify-center p-6'>
						<div className='max-w-sm text-center'>
							<FileText className='mx-auto mb-3 h-10 w-10 text-gray-400' aria-hidden='true' />
							<h3 className='font-medium text-gray-900'>The PDF can’t be shown here</h3>
							<p className='mt-1 text-sm text-gray-600'>Open it in a new tab or download it instead.</p>
							<div className='mt-4 flex justify-center gap-2'>
								{paper.filename && (
									<button
										type='button'
										onClick={() => {
											setPdfState('loading');
											setIframeKey((k) => k + 1);
										}}
										className={buttonClasses('outline', 'sm')}
									>
										Try again
									</button>
								)}
								<a href={pdfUrl} target='_blank' rel='noreferrer' className={buttonClasses('primary', 'sm')}>
									Open PDF
								</a>
							</div>
						</div>
					</div>
				)}
				{paper.filename && (
					<iframe
						key={iframeKey}
						src={pdfUrl}
						title={`PDF of ${paper.title}`}
						onLoad={() => setPdfState('ready')}
						onError={() => setPdfState('error')}
						className={clsx('h-full w-full border-0', pdfState !== 'ready' && 'invisible')}
					/>
				)}
			</div>

			<Modal
				open={openModal === 'summary' && !!summary}
				onClose={closeModal}
				title='Paper summary'
				icon={<FileText className='h-5 w-5' />}
				footer={summary && modalFooter('summary', summaryAsText(summary))}
			>
				{summary && <SummaryView summary={summary} />}
			</Modal>
			<Modal
				open={openModal === 'assessment' && !!assessment}
				onClose={closeModal}
				title='Paper assessment'
				icon={<ClipboardCheck className='h-5 w-5' />}
				footer={assessment && modalFooter('assessment', assessmentAsText(assessment))}
			>
				{assessment && <AssessmentView assessment={assessment} />}
			</Modal>
		</div>
	);
};

export default PaperViewer;
