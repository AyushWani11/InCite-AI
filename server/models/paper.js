const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema({
	title: String,
	authors: [String],
	publicationDate: Date,
	keywords: [String],
	filename: String,
	uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	createdAt: { type: Date, default: Date.now },
	summary: String,
	contributions: [String],
	methodology: String,
	findings: String,
	conclusion: String,
	summary: {
		type: Object, // contains summary, findings, methodology, etc.
		default: null,
	},
	assessment: {
		type: Object, // contains score, feedback, issues, suggestions
		default: null,
	},
});

module.exports = mongoose.model('Paper', PaperSchema);
