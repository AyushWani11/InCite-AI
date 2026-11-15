// app.js: builds the Express app without starting it.
// server.js connects to MongoDB and listens; tests import this file directly.
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const chatRoutes = require('./routes/chat');
const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/research');

const app = express();
app.use(cookieParser());

const corsOptions = {
	origin:
		process.env.NODE_ENV === 'production'
			? process.env.FRONTEND_URL // Production frontend URL
			: 'https://in-cite-ai.vercel.app', // Development frontend URL
	credentials: true, // Allow cookies to be sent with requests
	// Let the frontend (a different site in production) read chat sources.
	exposedHeaders: ['X-Sources'],
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Saved chat history may also arrive as text/plain (JSON text): browsers send
// that without a CORS preflight, which matters for a save made while the page
// is closing. The route parses it after the login check. (This used to call
// JSON.parse here on every request, including JSON bodies that were already
// parsed above, so every save failed with 400.)
app.use('/api/chat/save-history', express.text({ type: 'text/plain' }));

app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/paper', paperRoutes);

module.exports = app;
