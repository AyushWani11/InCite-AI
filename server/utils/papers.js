const mongoose = require('mongoose');
const Paper = require('../models/paper');

/**
 * Fetch a paper only if it belongs to this user.
 *
 * Returns null when the id is malformed, when no such paper exists, and when
 * the paper belongs to someone else. Callers answer 404 in all three cases,
 * so a user cannot even learn whether another user's paper id exists.
 */
async function findOwnedPaper(paperId, userId) {
	if (!mongoose.isObjectIdOrHexString(paperId)) return null;
	return Paper.findOne({ _id: paperId, uploadedBy: userId });
}

module.exports = { findOwnedPaper };
