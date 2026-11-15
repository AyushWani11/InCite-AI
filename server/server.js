// server.js: entry point. Connects to MongoDB and starts the HTTP server.
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => console.log('MongoDB connected'))
	.catch((err) => console.error('MongoDB connection error:', err));

const PORT = 5000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
