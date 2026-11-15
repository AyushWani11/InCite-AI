import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, MessageCircle, Loader2, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import SidebarPapers from '../components/layout/SidebarPapers.tsx';
import ChatInterface from '../components/layout/ChatInterface.tsx';
import DashNavbar, { type DashUser } from '../components/layout/DashNavbar.tsx';
import PaperViewer from '../components/layout/PaperViewer.tsx';
import { Button, Toast, type ToastMessage } from '../components/common';
import { API_BASE_URL as backendUrl } from '../config';
import { useMediaQuery } from '../utils/useMediaQuery';
import { NETWORK_ERROR } from '../utils/http';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
}

const MIN_PAPER_WIDTH = 30;
const MAX_PAPER_WIDTH = 75;

// Divider between the paper and the chat: drag it, or focus it and use the
// arrow keys.
const ResizableHandle: React.FC<{
	value: number;
	onChange: (percent: number) => void;
	containerRef: React.RefObject<HTMLElement | null>;
}> = ({ value, onChange, containerRef }) => {
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		if (!dragging) return;
		const onMove = (e: MouseEvent) => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (rect) onChange(((e.clientX - rect.left) / rect.width) * 100);
		};
		const onUp = () => setDragging(false);
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
		return () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};
	}, [dragging, onChange, containerRef]);

	return (
		<>
			<div
				role='separator'
				aria-orientation='vertical'
				aria-label='Resize the paper and chat panels'
				aria-valuemin={MIN_PAPER_WIDTH}
				aria-valuemax={MAX_PAPER_WIDTH}
				aria-valuenow={Math.round(value)}
				tabIndex={0}
				onMouseDown={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onKeyDown={(e) => {
					if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
						e.preventDefault();
						onChange(value + (e.key === 'ArrowLeft' ? -5 : 5));
					}
				}}
				className="relative w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-teal-500 focus-visible:bg-teal-500 focus-visible:outline-none transition-colors before:absolute before:inset-y-0 before:-left-1.5 before:-right-1.5 before:content-['']"
			/>
			{/* While dragging, cover the page so the PDF iframe can't swallow
			    the mouse events. */}
			{dragging && <div className='fixed inset-0 z-50 cursor-col-resize' />}
		</>
	);
};

const FullPageMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<div className='h-dvh flex flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center'>
		{children}
	</div>
);

const Dashboard: React.FC = () => {
	const navigate = useNavigate();
	const isDesktop = useMediaQuery('(min-width: 768px)');
	const mainRef = useRef<HTMLElement>(null);

	const [user, setUser] = useState<DashUser | null>(null);
	const [authState, setAuthState] = useState<'checking' | 'ok' | 'offline'>('checking');
	const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
	const [paperWidth, setPaperWidth] = useState(55);
	const [sidebarOpen, setSidebarOpen] = useState(true); // desktop
	const [drawerOpen, setDrawerOpen] = useState(false); // phones
	const [mobileTab, setMobileTab] = useState<'paper' | 'chat'>('paper');
	const [refreshKey, setRefreshKey] = useState(0);
	const [toast, setToast] = useState<ToastMessage | null>(null);

	// The dashboard is only for logged-in users: send everyone else to log in.
	const checkLogin = useCallback(async () => {
		setAuthState('checking');
		try {
			const res = await fetch(`${backendUrl}/auth/check-login`, { credentials: 'include' });
			if (res.status === 401 || res.status === 404) {
				navigate('/login', { replace: true });
				return;
			}
			if (!res.ok) throw new Error(`check-login ${res.status}`);
			const data = await res.json();
			setUser(data.user);
			setAuthState('ok');
		} catch {
			setAuthState('offline');
		}
	}, [navigate]);

	useEffect(() => {
		checkLogin();
	}, [checkLogin]);

	// Toasts disappear on their own (errors stay a little longer).
	useEffect(() => {
		if (!toast) return;
		const id = setTimeout(() => setToast(null), toast.tone === 'error' ? 8000 : 4000);
		return () => clearTimeout(id);
	}, [toast]);

	// Escape closes the paper drawer on phones.
	useEffect(() => {
		if (!drawerOpen) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [drawerOpen]);

	const handlePaperSelect = useCallback((paper: Paper) => {
		setSelectedPaper(paper);
		setDrawerOpen(false);
		setMobileTab('paper');
	}, []);

	const handleResize = useCallback(
		(percent: number) => setPaperWidth(Math.max(MIN_PAPER_WIDTH, Math.min(MAX_PAPER_WIDTH, percent))),
		[]
	);

	const handleLogout = async () => {
		await fetch(`${backendUrl}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
		navigate('/');
	};

	if (authState === 'checking') {
		return (
			<FullPageMessage>
				<Loader2 className='w-8 h-8 text-teal-600 animate-spin' aria-hidden='true' />
				<p className='text-gray-600'>Loading your workspace…</p>
			</FullPageMessage>
		);
	}
	if (authState === 'offline' || !user) {
		return (
			<FullPageMessage>
				<WifiOff className='w-8 h-8 text-gray-400' aria-hidden='true' />
				<p className='text-gray-700 max-w-sm'>{NETWORK_ERROR}</p>
				<Button onClick={checkLogin}>Try again</Button>
			</FullPageMessage>
		);
	}

	const sidebar = (
		<SidebarPapers selectedPaper={selectedPaper} onPaperSelect={handlePaperSelect} refreshKey={refreshKey} />
	);
	const chat = <ChatInterface selectedPaper={selectedPaper} />;
	const viewer = selectedPaper && <PaperViewer paper={selectedPaper} onClose={() => setSelectedPaper(null)} />;

	return (
		<div className='h-dvh flex flex-col bg-gray-50'>
			<DashNavbar
				user={user}
				isDesktop={isDesktop}
				sidebarOpen={isDesktop ? sidebarOpen : drawerOpen}
				onToggleSidebar={() => (isDesktop ? setSidebarOpen((o) => !o) : setDrawerOpen(true))}
				onUploaded={() => setRefreshKey((k) => k + 1)}
				onNotify={setToast}
				onLogout={handleLogout}
			/>

			{isDesktop ? (
				<div className='flex-1 flex min-h-0'>
					{sidebarOpen && (
						<div className='w-80 shrink-0 border-r border-gray-200 bg-white overflow-y-auto'>{sidebar}</div>
					)}
					<main ref={mainRef} className='flex-1 flex min-w-0'>
						{selectedPaper && (
							<>
								<section aria-label='Paper' className='min-w-0' style={{ width: `${paperWidth}%` }}>
									{viewer}
								</section>
								<ResizableHandle value={paperWidth} onChange={handleResize} containerRef={mainRef} />
							</>
						)}
						<section
							aria-label='Chat'
							className='min-w-0'
							style={{ width: selectedPaper ? `${100 - paperWidth}%` : '100%' }}
						>
							{chat}
						</section>
					</main>
				</div>
			) : (
				<main className='flex-1 flex flex-col min-h-0'>
					{selectedPaper && (
						<div role='tablist' aria-label='Show the paper or the chat' className='flex bg-white border-b border-gray-200'>
							{(
								[
									['paper', 'Paper', FileText],
									['chat', 'Chat', MessageCircle],
								] as const
							).map(([id, label, Icon]) => (
								<button
									key={id}
									type='button'
									role='tab'
									aria-selected={mobileTab === id}
									onClick={() => setMobileTab(id)}
									className={clsx(
										'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 focus-visible:outline-none focus-visible:bg-gray-50',
										mobileTab === id ? 'border-teal-600 text-teal-800' : 'border-transparent text-gray-500'
									)}
								>
									<Icon className='w-4 h-4' aria-hidden='true' />
									{label}
								</button>
							))}
						</div>
					)}
					{/* Both stay mounted so switching tabs keeps the conversation. */}
					<div className='flex-1 min-h-0 relative'>
						{selectedPaper && (
							<div className={clsx('absolute inset-0', mobileTab === 'paper' ? 'block' : 'hidden')}>{viewer}</div>
						)}
						<div className={clsx('absolute inset-0', !selectedPaper || mobileTab === 'chat' ? 'block' : 'hidden')}>
							{chat}
						</div>
					</div>

					{drawerOpen && (
						<div className='fixed inset-0 z-40' role='dialog' aria-modal='true' aria-label='Your papers'>
							<div className='absolute inset-0 bg-gray-900/40' onClick={() => setDrawerOpen(false)} />
							<div className='absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl flex flex-col'>
								<div className='flex items-center justify-between px-4 h-14 border-b border-gray-200 shrink-0'>
									<h2 className='font-semibold text-gray-900'>Your papers</h2>
									<button
										type='button'
										onClick={() => setDrawerOpen(false)}
										className='p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
										aria-label='Close paper list'
									>
										<X className='w-5 h-5' />
									</button>
								</div>
								<div className='flex-1 overflow-y-auto'>{sidebar}</div>
							</div>
						</div>
					)}
				</main>
			)}

			<Toast toast={toast} onDismiss={() => setToast(null)} />
		</div>
	);
};

export default Dashboard;
