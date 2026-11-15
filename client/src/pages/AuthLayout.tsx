import React from 'react';
import { Logo } from '../components/common';

interface AuthLayoutProps {
	pageTitle: string; // shown in the browser tab
	title: string;
	subtitle: string;
	footer: React.ReactNode;
	children: React.ReactNode;
}

// Shared frame for the login and sign-up pages: logo, card, footer link.
const AuthLayout: React.FC<AuthLayoutProps> = ({ pageTitle, title, subtitle, footer, children }) => (
	<div className='min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12'>
		{/* React 19 moves this into <head>. */}
		<title>{`${pageTitle} · InCite AI`}</title>
		<Logo className='mb-8' />
		<main className='w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8'>
			<h1 className='text-2xl font-semibold text-gray-900'>{title}</h1>
			<p className='mt-1 text-sm text-gray-600'>{subtitle}</p>
			<div className='mt-6'>{children}</div>
		</main>
		<p className='mt-6 text-sm text-gray-600'>{footer}</p>
	</div>
);

export default AuthLayout;
