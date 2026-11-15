// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/research');

const cookieParser = require('cookie-parser');

// Initialize Express app
const app = express();
app.use(cookieParser());

const corsOptions = {
	origin:
		process.env.NODE_ENV === 'production'
			? process.env.FRONTEND_URL // Production frontend URL
			: 'https://in-cite-ai.vercel.app', // Development frontend URL
	credentials: true, // Allow cookies to be sent with requests
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
	'/api/chat/save-history',
	express.text({ type: 'text/plain' }),
	(req, res, next) => {
		try {
			req.body = JSON.parse(req.body); // Manually parse the text into JSON
			next(); // Pass to the next middleware
		} catch (error) {
			res.status(400).json({ error: 'Invalid JSON format' });
		}
	}
);

// Use chat routes
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/paper', paperRoutes);

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
