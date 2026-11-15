import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo, buttonClasses } from '../common';
import { API_BASE_URL as backendUrl } from '../../config';

const sectionLinks = [
	{ href: '#features', label: 'Features' },
	{ href: '#how-it-works', label: 'How it works' },
];

const linkClass =
	'text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

// Navigation for the public pages: section links, and log in / sign up or,
// when logged in, a way into the dashboard.
const Navbar: React.FC = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [user, setUser] = useState<{ username: string } | null>(null);

	useEffect(() => {
		fetch(`${backendUrl}/auth/check-login`, { credentials: 'include' })
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => setUser(data?.user?.username ? data.user : null))
			.catch(() => setUser(null));
	}, []);

	const closeMenu = () => setIsMenuOpen(false);

	const handleLogout = async () => {
		await fetch(`${backendUrl}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
		setUser(null);
		closeMenu();
	};

	const authActions = (fullWidth: boolean) => {
		const width = fullWidth ? 'w-full' : undefined;
		return user ? (
			<>
				<span className='text-sm text-gray-600'>Hi, {user.username}</span>
				<Link to='/dashboard' className={buttonClasses('primary', 'sm', width)} onClick={closeMenu}>
					Open dashboard
				</Link>
				<button type='button' onClick={handleLogout} className={buttonClasses('ghost', 'sm', width)}>
					Log out
				</button>
			</>
		) : (
			<>
				<Link to='/login' className={buttonClasses('ghost', 'sm', width)} onClick={closeMenu}>
					Log in
				</Link>
				<Link to='/signup' className={buttonClasses('primary', 'sm', width)} onClick={closeMenu}>
					Sign up
				</Link>
			</>
		);
	};

	return (
		<nav aria-label='Main' className='fixed inset-x-0 top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4'>
				<Logo />

				<div className='hidden md:flex items-center gap-8'>
					{sectionLinks.map((l) => (
						<a key={l.href} href={l.href} className={linkClass}>
							{l.label}
						</a>
					))}
				</div>

				<div className='hidden md:flex items-center gap-3'>{authActions(false)}</div>

				<button
					type='button'
					className='md:hidden -mr-2 p-2 rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
					onClick={() => setIsMenuOpen((open) => !open)}
					aria-expanded={isMenuOpen}
					aria-controls='mobile-menu'
					aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
				>
					{isMenuOpen ? <X className='h-6 w-6' /> : <Menu className='h-6 w-6' />}
				</button>
			</div>

			{isMenuOpen && (
				<div id='mobile-menu' className='md:hidden border-t border-gray-200 bg-white px-4 pb-4'>
					<div className='flex flex-col py-2'>
						{sectionLinks.map((l) => (
							<a key={l.href} href={l.href} onClick={closeMenu} className={`${linkClass} py-3`}>
								{l.label}
							</a>
						))}
					</div>
					<div className='flex flex-col gap-2 pt-4 border-t border-gray-100'>{authActions(true)}</div>
				</div>
			)}
		</nav>
	);
};

export default Navbar;
