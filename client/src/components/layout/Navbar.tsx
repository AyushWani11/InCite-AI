import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Menu, X } from 'lucide-react';
import { Button } from '../common';

const Navbar: React.FC = () => {
	const [isMenuOpen, setIsMenuOpen] = React.useState(false);

	const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

	return (
		<nav className='fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				<div className='flex justify-between items-center h-16'>
					{/* Logo */}
					<div className='flex items-center'>
						<Link to='/' className='flex items-center space-x-2'>
							<div className='w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center'>
								<FileText className='w-5 h-5 text-white' />
							</div>
							<span className='text-xl font-bold text-gray-900'>InCite AI</span>
						</Link>
					</div>

					{/* Desktop Navigation */}
					<div className='hidden md:block'>
						<div className='ml-10 flex items-baseline space-x-8'>
							<a
								href='#features'
								className='text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium'
							>
								Features
							</a>
							<a
								href='#how-it-works'
								className='text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium'
							>
								How it Works
							</a>
							<a
								href='#pricing'
								className='text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium'
							>
								Pricing
							</a>
							<a
								href='#contact'
								className='text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium'
							>
								Contact
							</a>
						</div>
					</div>

					{/* Desktop CTA */}
					<div className='hidden md:flex items-center space-x-4'>
						<Link to='/signup'>
							<Button variant='ghost' size='sm'>
								Sign In
							</Button>
						</Link>
						<Link to='/login'>
							<Button size='sm' className='bg-teal-500 hover:bg-teal-600'>
								Get Started
							</Button>
						</Link>
					</div>

					{/* Mobile menu button */}
					<div className='md:hidden'>
						<button
							onClick={toggleMenu}
							className='inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100'
						>
							{isMenuOpen ? (
								<X className='block h-6 w-6' />
							) : (
								<Menu className='block h-6 w-6' />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile menu */}
			{isMenuOpen && (
				<div className='md:hidden'>
					<div className='px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200'>
						<a
							href='#features'
							className='text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium'
						>
							Features
						</a>
						<a
							href='#how-it-works'
							className='text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium'
						>
							How it Works
						</a>
						<a
							href='#pricing'
							className='text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium'
						>
							Pricing
						</a>
						<a
							href='#contact'
							className='text-gray-600 hover:text-gray-900 block px-3 py-2 text-base font-medium'
						>
							Contact
						</a>
						<div className='px-3 py-2 space-y-2'>
							<Link to='/register' className='block'>
								<Button variant='ghost' size='sm' className='w-full'>
									Sign In
								</Button>
							</Link>
							<Link to='/register' className='block'>
								<Button
									size='sm'
									className='w-full bg-teal-500 hover:bg-teal-600'
								>
									Get Started
								</Button>
							</Link>
						</div>
					</div>
				</div>
			)}
		</nav>
	);
};

export default Navbar;
