import React, { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { Upload, PanelLeftClose, PanelLeftOpen, Library, LogOut, Home } from 'lucide-react';
import { Logo, buttonClasses } from '../common';
import type { ToastMessage } from '../common';
import { API_BASE_URL as backendUrl } from '../../config';
import { NETWORK_ERROR } from '../../utils/http';

export interface DashUser {
	_id?: string;
	username: string;
	email?: string;
}

interface DashNavbarProps {
	user: DashUser;
	isDesktop: boolean;
	sidebarOpen: boolean;
	onToggleSidebar: () => void;
	onUploaded: () => void;
	onNotify: (toast: ToastMessage) => void;
	onLogout: () => void;
}

const iconButton =
	'p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const DashNavbar: React.FC<DashNavbarProps> = ({
	user,
	isDesktop,
	sidebarOpen,
	onToggleSidebar,
	onUploaded,
	onNotify,
	onLogout,
}) => {
	const [isUploading, setIsUploading] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close the user menu on an outside click or Escape.
	useEffect(() => {
		if (!menuOpen) return;
		const onClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
		};
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
		document.addEventListener('mousedown', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onClick);
			document.removeEventListener('keydown', onKey);
		};
	}, [menuOpen]);

	const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		setIsUploading(true);
		const formData = new FormData();
		for (const file of Array.from(files)) formData.append('files', file);

		try {
			const response = await fetch(`${backendUrl}/paper/upload`, {
				method: 'POST',
				credentials: 'include',
				body: formData,
			});
			// The server reports each file that failed: { filename, error }.
			const json = await response.json().catch(() => ({}));
			const failedList = (json.failed || [])
				.map((f: { filename: string; error: string }) => `• ${f.filename}: ${f.error}`)
				.join('\n');
			const saved = json.papers?.length ?? 0;

			if (saved > 0) onUploaded();
			if (!response.ok) {
				onNotify({ tone: 'error', text: `${json.error || 'Upload failed.'}${failedList ? `\n${failedList}` : ''}` });
			} else if (failedList) {
				onNotify({ tone: 'error', text: `Uploaded ${saved} paper(s), but some files failed:\n${failedList}` });
			} else {
				onNotify({ tone: 'success', text: saved === 1 ? 'Paper uploaded.' : `${saved} papers uploaded.` });
			}
		} catch {
			onNotify({ tone: 'error', text: NETWORK_ERROR });
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = '';
			setIsUploading(false);
		}
	};

	const initial = user.username.charAt(0).toUpperCase();

	return (
		<header className='bg-white border-b border-gray-200 px-3 sm:px-5 h-16 flex items-center justify-between gap-3 shrink-0'>
			<input
				type='file'
				accept='.pdf,application/pdf'
				multiple
				ref={fileInputRef}
				className='hidden'
				onChange={handleFilesSelected}
			/>

			<div className='flex items-center gap-1 sm:gap-3 min-w-0'>
				<button
					type='button'
					onClick={onToggleSidebar}
					className={iconButton}
					aria-label={isDesktop ? (sidebarOpen ? 'Hide paper list' : 'Show paper list') : 'Open paper list'}
					aria-expanded={sidebarOpen}
				>
					{isDesktop ? (
						sidebarOpen ? <PanelLeftClose className='w-5 h-5' /> : <PanelLeftOpen className='w-5 h-5' />
					) : (
						<Library className='w-5 h-5' />
					)}
				</button>
				<Logo to='/dashboard' />
			</div>

			<div className='flex items-center gap-2 sm:gap-3'>
				<button
					type='button'
					onClick={() => fileInputRef.current?.click()}
					disabled={isUploading}
					className={buttonClasses('primary', 'md')}
					aria-label={isUploading ? 'Uploading' : 'Upload papers (PDF)'}
				>
					<Upload className='w-4 h-4' aria-hidden='true' />
					<span className='hidden sm:inline'>{isUploading ? 'Uploading…' : 'Upload PDF'}</span>
				</button>

				<div className='relative' ref={menuRef}>
					<button
						type='button'
						onClick={() => setMenuOpen((o) => !o)}
						className='w-10 h-10 rounded-full bg-teal-700 text-white font-semibold flex items-center justify-center hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'
						aria-haspopup='menu'
						aria-expanded={menuOpen}
						aria-label={`Account menu for ${user.username}`}
					>
						{initial}
					</button>
					{menuOpen && (
						<div
							role='menu'
							className='absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white shadow-lg py-2 z-50'
						>
							<div className='px-4 py-2 border-b border-gray-100'>
								<p className='text-sm font-medium text-gray-900 truncate'>{user.username}</p>
								{user.email && <p className='text-xs text-gray-500 truncate'>{user.email}</p>}
							</div>
							<Link
								to='/'
								role='menuitem'
								className='flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50'
							>
								<Home className='w-4 h-4' aria-hidden='true' /> Home page
							</Link>
							<button
								type='button'
								role='menuitem'
								onClick={onLogout}
								className='w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50'
							>
								<LogOut className='w-4 h-4' aria-hidden='true' /> Log out
							</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
};

export default DashNavbar;
