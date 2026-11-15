const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// One saved conversation. chatSessionId is chosen by the client (one per open
// chat) or by the server; it is unique per user, not globally.
const ChatSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		chatSessionId: { type: String, required: true },
		history: [
			{
				// Same role names the client and POST /api/chat use. (Documents
				// saved by older versions may say "vega"; reads map it.)
				role: { type: String, enum: ['user', 'assistant'], required: true },
				parts: [
					{
						text: { type: String, required: true },
					},
				],
			},
		],
	},
	// createdAt and updatedAt, maintained by Mongoose (also on upserts).
	{ timestamps: true }
);

// Saving "the same session again" is an upsert on these two fields; the
// unique index stops two concurrent saves from creating duplicates.
ChatSchema.index({ userId: 1, chatSessionId: 1 }, { unique: true });

module.exports = mongoose.model('Chatlog', ChatSchema);
