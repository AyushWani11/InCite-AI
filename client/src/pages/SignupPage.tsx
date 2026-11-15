import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button, Input } from '../components/common';
import { API_BASE_URL as backendUrl } from '../config';
import { messageOf, readError } from '../utils/http';

type Field = 'username' | 'email' | 'password' | 'confirmPassword';

// Checked in the browser first: the server rejects these too, but some of
// them (short username, mismatched passwords) only come back as a generic
// "Server error".
function validate(form: Record<Field, string>): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {};
	if (form.username.trim().length < 3) errors.username = 'Use at least 3 characters.';
	if (form.password.length < 6) errors.password = 'Use at least 6 characters.';
	if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match.";
	return errors;
}

const SignupPage: React.FC = () => {
	const [form, setForm] = useState<Record<Field, string>>({
		username: '',
		email: '',
		password: '',
		confirmPassword: '',
	});
	const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const navigate = useNavigate();

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setForm({ ...form, [e.target.name]: e.target.value });
		setFieldErrors({ ...fieldErrors, [e.target.name]: undefined });
	};

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError('');
		const problems = validate(form);
		setFieldErrors(problems);
		if (Object.keys(problems).length) return;

		setSubmitting(true);
		try {
			const res = await fetch(`${backendUrl}/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(form),
			});
			if (!res.ok) {
				const reason = await readError(res, 'Could not create your account. Please try again.');
				throw new Error(
					reason === 'Server error'
						? 'Could not create your account. That username may already be taken.'
						: reason
				);
			}
			navigate('/dashboard');
		} catch (err) {
			setError(messageOf(err, 'Could not create your account. Please try again.'));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthLayout
			title='Create your account'
			subtitle='Upload papers, ask questions, and get summaries in one place.'
			footer={
				<>
					Already have an account?{' '}
					<Link to='/login' className='font-medium text-teal-700 hover:underline'>
						Log in
					</Link>
				</>
			}
		>
			<form onSubmit={onSubmit} noValidate className='space-y-5'>
				{error && (
					<div role='alert' className='rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700'>
						{error}
					</div>
				)}
				<Input
					label='Username'
					name='username'
					autoComplete='username'
					required
					hint='At least 3 characters.'
					error={fieldErrors.username}
					value={form.username}
					onChange={onChange}
				/>
				<Input
					label='Email'
					name='email'
					type='email'
					autoComplete='email'
					required
					value={form.email}
					onChange={onChange}
				/>
				<Input
					label='Password'
					name='password'
					type='password'
					autoComplete='new-password'
					required
					hint='At least 6 characters.'
					error={fieldErrors.password}
					value={form.password}
					onChange={onChange}
				/>
				<Input
					label='Confirm password'
					name='confirmPassword'
					type='password'
					autoComplete='new-password'
					required
					error={fieldErrors.confirmPassword}
					value={form.confirmPassword}
					onChange={onChange}
				/>
				<Button type='submit' className='w-full' disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create account'}
				</Button>
			</form>
		</AuthLayout>
	);
};

export default SignupPage;
