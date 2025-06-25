import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Logout.css';

// Backend URL
const backendUrl =
	process.env.NODE_ENV === 'production'
		? process.env.BACKEND_URL || 'https://incite-ai-4vrv.onrender.com/api'
		: 'https://incite-ai-4vrv.onrender.com/api';

const Logout = () => {
	const navigate = useNavigate();

	useEffect(() => {
		const logoutUser = async () => {
			try {
				// Make the POST request to the logout endpoint using fetch
				const response = await fetch(backendUrl + '/auth/logout', {
					method: 'POST',
					credentials: 'include', // Include cookies to clear the JWT token
				});

				if (response.ok) {
					navigate('/login'); // Redirect to login page after successful logout
				} else {
					console.error('Failed to log out');
				}
			} catch (err) {
				console.error('Error logging out:', err);
			}
		};

		logoutUser();
	}, [navigate]);

	return (
		<div className='container'>
			<div className='form-box login'>
				<form action=''>
					<h1>Thank You for Using Incite AI</h1>
					<h3>See You Later!</h3>
				</form>
			</div>
			<div className='toggle-box'>
				<div className='toggle-panel toggle-left'>
					<h1>You are Logged Out</h1>
					<a href='/login' className='btn register-btn'>
						Sign back in
					</a>
				</div>
			</div>
		</div>
	);
};

export default Logout;
