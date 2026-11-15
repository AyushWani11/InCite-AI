import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Button, Input } from '../components/common';
import { API_BASE_URL as backendUrl } from '../config';
import { messageOf, readError } from '../utils/http';

const LoginPage: React.FC = () => {
	const [form, setForm] = useState({ email: '', password: '' });
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const navigate = useNavigate();

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
		setForm({ ...form, [e.target.name]: e.target.value });

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setSubmitting(true);
		setError('');
		try {
			const res = await fetch(`${backendUrl}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(form),
			});
			if (!res.ok) {
				const reason = await readError(res, 'Could not log in. Please try again.');
				throw new Error(reason === 'Invalid credentials' ? 'Email or password is incorrect.' : reason);
			}
			navigate('/dashboard');
		} catch (err) {
			setError(messageOf(err, 'Could not log in. Please try again.'));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthLayout
			pageTitle='Log in'
			title='Welcome back'
			subtitle='Log in to chat with your research papers.'
			footer={
				<>
					New to InCite AI?{' '}
					<Link to='/signup' className='font-medium text-teal-700 hover:underline'>
						Create an account
					</Link>
				</>
			}
		>
			<form onSubmit={onSubmit} className='space-y-5'>
				{error && (
					<div role='alert' className='rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700'>
						{error}
					</div>
				)}
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
					autoComplete='current-password'
					required
					value={form.password}
					onChange={onChange}
				/>
				<Button type='submit' className='w-full' disabled={submitting}>
					{submitting ? 'Logging in…' : 'Log in'}
				</Button>
			</form>
		</AuthLayout>
	);
};

export default LoginPage;
