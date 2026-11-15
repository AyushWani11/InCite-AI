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

// ---------- Stored PDF files (GridFS bucket "papers") ----------

function bucket() {
	return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
		bucketName: 'papers',
	});
}

function filesCollection() {
	return mongoose.connection.db.collection('papers.files');
}

// Uploads record metadata.uploadedBy as the user id string; accept an
// ObjectId too in case any older record stored it that way.
function uploadedByUser(userId) {
	const id = String(userId);
	const values = [id];
	if (mongoose.isObjectIdOrHexString(id)) {
		values.push(new mongoose.Types.ObjectId(id));
	}
	return { 'metadata.uploadedBy': { $in: values } };
}

/** The newest file with this name that this user uploaded, or null. */
async function findUserFileByName(filename, userId) {
	if (!filename) return null;
	return filesCollection().findOne(
		{ filename, ...uploadedByUser(userId) },
		{ sort: { uploadDate: -1 } }
	);
}

/**
 * The GridFS file record for a paper, or null.
 *
 * New papers store their file's id. Older papers only stored the original
 * filename, which different users can share, so for those we also require
 * that the paper's owner uploaded the file.
 */
async function findPaperFile(paper) {
	if (paper.fileId) return filesCollection().findOne({ _id: paper.fileId });
	return findUserFileByName(paper.filename, paper.uploadedBy);
}

function openFileStream(file) {
	return bucket().openDownloadStream(file._id);
}

async function readFile(file) {
	const chunks = [];
	for await (const chunk of openFileStream(file)) chunks.push(chunk);
	return Buffer.concat(chunks);
}

/** The paper's PDF as a Buffer, or null if its file is missing. */
async function readPaperFile(paper) {
	const file = await findPaperFile(paper);
	return file ? readFile(file) : null;
}

/** Delete this paper's stored PDF (and only that one). */
async function deletePaperFile(paper) {
	const file = await findPaperFile(paper);
	if (file) await bucket().delete(file._id);
}

module.exports = {
	findOwnedPaper,
	findUserFileByName,
	findPaperFile,
	openFileStream,
	readFile,
	readPaperFile,
	deletePaperFile,
};
