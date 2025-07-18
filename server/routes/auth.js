const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const User = require('../models/user'); // User model
const authLogin = require('../middleware/authToken');

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Connect to MongoDB
mongoose
	.connect(process.env.MONGODB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => console.log('MongoDB connected'))
	.catch((err) => console.error('MongoDB connection error:', err));

// Routes

// Register a new user
router.post(
	'/register',
	[
		check('username', 'Username is required').not().isEmpty(),
		check('email', 'Please include a valid email').isEmail(),
		check('password', 'Password must be 6 or more characters').isLength({
			min: 6,
		}),
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { username, email, password, confirmPassword } = req.body;

		try {
			let user = await User.findOne({ email });
			if (user) {
				return res.status(400).json({ msg: 'User already exists' });
			}

			user = new User({
				username,
				email,
				password,
			});

			user.confirmPassword = confirmPassword;

			await user.save();

			// Generate JWT token
			const payload = { user: { id: user.id } };
			const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });

			res.cookie('token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'none',
				maxAge: 3 * 60 * 60 * 1000,
			});

			console.log('Token:', token);

			res.status(200).json({ msg: 'User registered successfully' });
		} catch (err) {
			console.error('Registration error:', err);
			res.status(500).json({ msg: 'Server error' });
		}
	}
);

// Login user
router.post(
	'/login',
	[
		check('email', 'Please include a valid email').isEmail(),
		check('password', 'Password is required').exists(),
	],
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const { email, password } = req.body;

		try {
			let user = await User.findOne({ email });
			if (!user) {
				return res.status(400).json({ msg: 'Invalid credentials' });
			}

			const isMatch = await bcrypt.compare(password, user.password);
			if (!isMatch) {
				return res.status(400).json({ msg: 'Invalid credentials' });
			}

			const payload = { user: { id: user.id } };
			const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });

			// Set token as an HTTP-only cookie
			res.cookie('token', token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
				sameSite: 'None',
				maxAge: 3 * 60 * 60 * 1000, // Cookie expires in 3 hours
			});

			console.log('Token:', token);

			res.status(200).json({ msg: 'Login successful' });
		} catch (err) {
			console.error('Login error:', err);
			res.status(500).send('Server error');
		}
	}
);

// Check if the user is logged in
router.get('/check-login', authLogin, async (req, res) => {
	try {
		const user = await User.findById(req.user.id).select('username email');
		if (!user) return res.status(401).json({ msg: 'User not found' });

		res.status(200).json({ msg: 'User is logged in', user });
	} catch (err) {
		console.error('Check-login error:', err);
		res.status(500).json({ msg: 'Server error' });
	}
});

// Logout user
router.post('/logout', (req, res) => {
	res.clearCookie('token', {
		httpOnly: true,
		secure: true,
		sameSite: 'none',
	});
	res.status(200).json({ msg: 'Logged out successfully' });
});

module.exports = router;
