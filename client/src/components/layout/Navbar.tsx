import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Menu, X } from 'lucide-react';
import { Button } from '../common';

const backendUrl =
	process.env.NODE_ENV === 'production'
		? 'https://incite-ai-4vrv.onrender.com/api'
		: 'https://incite-ai-4vrv.onrender.com/api';

const Navbar: React.FC = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [user, setUser] = useState<{ username: string } | null>(null);

	const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

	// Check login status on mount
	useEffect(() => {
		fetch(`${backendUrl}/auth/check-login`, {
			method: 'GET',
			credentials: 'include',
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.user?.username) {
					setUser(data.user);
				}
			})
			.catch(() => setUser(null));
	}, []);

	const handleLogout = async () => {
		await fetch(`${backendUrl}/auth/logout`, {
			method: 'POST',
			credentials: 'include',
		});
		setUser(null);
		window.location.reload();
	};

	return (
		<nav className='fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center h-16'>
					{/* Logo */}
					<Link to='/' className='flex items-center space-x-2'>
						<div className='w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center'>
							<FileText className='w-5 h-5 text-white' />
						</div>
						<span className='text-xl font-bold text-gray-900'>InCite AI</span>
					</Link>

					{/* Desktop Navigation */}
					<div className='hidden md:flex space-x-8 ml-10'>
						<a href='#features'>Features</a>
						<a href='#how-it-works'>How it Works</a>
						{/* <a href='#pricing'>Pricing</a>
						<a href='#contact'>Contact</a> */}
					</div>

					{/* Desktop CTA */}
					<div className='hidden md:flex items-center space-x-4'>
						{user ? (
							<>
								<span className='text-gray-700'>Hello, {user.username}</span>
								<Button
									size='sm'
									className='bg-teal-500 hover:bg-teal-600'
									onClick={handleLogout}
								>
									Logout
								</Button>
							</>
						) : (
							<>
								<Link to='/signup'>
									<Button variant='ghost' size='sm'>
										Sign Up
									</Button>
								</Link>
								<Link to='/login'>
									<Button size='sm' className='bg-teal-500 hover:bg-teal-600'>
										Log In
									</Button>
								</Link>
							</>
						)}
					</div>

					{/* Mobile menu button */}
					<div className='md:hidden'>
						<button onClick={toggleMenu}>
							{isMenuOpen ? (
								<X className='h-6 w-6' />
							) : (
								<Menu className='h-6 w-6' />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile Menu */}
			{isMenuOpen && (
				<div className='md:hidden bg-white px-3 pt-2 pb-4 space-y-2 border-t'>
					<a href='#features'>Features</a>
					<a href='#how-it-works'>How it Works</a>
					<a href='#pricing'>Pricing</a>
					<a href='#contact'>Contact</a>
					{user ? (
						<>
							<span className='block text-gray-700'>
								Hello, {user.username}
							</span>
							<Button
								variant='ghost'
								size='sm'
								className='w-full'
								onClick={handleLogout}
							>
								Logout
							</Button>
						</>
					) : (
						<>
							<Link to='/signup'>
								<Button variant='ghost' size='sm' className='w-full'>
									Sign In
								</Button>
							</Link>
							<Link to='/login'>
								<Button
									size='sm'
									className='w-full bg-teal-500 hover:bg-teal-600'
								>
									Get Started
								</Button>
							</Link>
						</>
					)}
				</div>
			)}
		</nav>
	);
};

export default Navbar;
