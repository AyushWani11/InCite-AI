import React from 'react';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, type = 'button', children, ...props }) => (
	<button type={type} className={buttonClasses(variant, size, className)} {...props}>
		{children}
	</button>
);

export default Button;
