import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
	'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors cursor-pointer ' +
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
	'disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
	// teal-700 keeps white text above the 4.5:1 contrast minimum (teal-500 is ~2.5:1)
	primary: 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-500',
	secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
	ghost: 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-400',
	outline: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 focus-visible:ring-teal-500',
	danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
};

const sizes: Record<ButtonSize, string> = {
	sm: 'px-3 py-2 text-sm',
	md: 'px-4 py-2.5 text-sm',
	lg: 'px-6 py-3 text-base',
};

// Classes for anything that should look like a button, e.g. a router <Link>
// (a <button> inside an <a> is invalid HTML).
export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
	clsx(base, variants[variant], sizes[size], className);
