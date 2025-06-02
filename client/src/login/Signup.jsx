import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Signup.css';

// Backend URL
const backendUrl =
	process.env.NODE_ENV === 'production'
		? 'https://vegaai.onrender.com/api'
		: 'http://localhost:5001/api';

const Signup = () => {
	const [formData, setFormData] = useState({
		username: '',
		email: '',
		password: '',
		confirm: '',
	});
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const navigate = useNavigate();

	const { username, email, password, confirm } = formData;

	const onChange = (e) =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const onSubmit = async (e) => {
		e.preventDefault();

		try {
			const response = await fetch(backendUrl + '/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include', // Include cookies in the request
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.msg || 'Registration failed.');
			}

			setSuccess('Registration successful!');
			setError('');
			navigate('/'); // Redirect after successful registration
		} catch (err) {
			setError(err.message);
			setSuccess('');
		}
	};

	return (  
          <div className="container">
    <div className="form-box login">
      <form action="">
        <h1>Sign Up</h1>
        <div className="input-box">
          <input type="text" placeholder="Username" value={username} onChange={onChange} required></input>
          {/* <i className='bx bxs-user'></i> */}
        </div>
        <div className="input-box">
          <input type="email" placeholder="Email" value={email} onChange={onChange} required></input>
          <i className='bx bxs-user'></i>
        </div>
        <div className="input-box">
          <input type="password" placeholder="Password" value={password} onChange={onChange} required></input>
          <i className='bx bxs-lock-alt'></i>
        </div>
        <div className="input-box">
          <input type="password" placeholder="Confirm Password" value={confirm} onChange={onChange} required></input>
          <i className='bx bxs-lock-alt'></i>
        </div>
        
          <button type="submit" className='btn login-btn'>Sign Up</button>
        

      </form>
    </div>
    <div className='toggle-box'>
        <div className='toggle-panel toggle-right'>
            <h1>Welcome to InCiteAI</h1>
            <p>Already have an account?</p>
            <a href='/login' className='btn register-btn' >Login</a>
        </div>
        
    </div>
    
    
  </div>

      );
  };

export default Signup;