// Checks a conversation the client wants to save. The client sends the same
// shape it sends to POST /api/chat: { sessionId?, history: [{ role, text }] }
// with role 'user' or 'assistant'.

const MAX_MESSAGES = 200;
const MAX_TEXT_CHARS = 20000;
const ROLES = ['user', 'assistant'];
// Chosen by the client (one per open chat), so saving the same conversation
// again updates it instead of adding a copy. Letters, digits, - and _ only.
const SESSION_ID = /^[A-Za-z0-9_-]{1,64}$/;

class HistoryError extends Error {}

// `body` is an object (JSON request) or a string (text/plain request, which
// browsers can send while a page is closing without a CORS preflight).
function parseSaveRequest(body) {
	let data = body;
	if (typeof data === 'string') {
		try {
			data = JSON.parse(data);
		} catch {
			throw new HistoryError('The request body is not valid JSON.');
		}
	}
	if (!data || typeof data !== 'object') throw new HistoryError('Send { history: [...] }.');

	const { history, sessionId } = data;
	if (!Array.isArray(history) || history.length === 0) {
		throw new HistoryError('history must be a non-empty list of messages.');
	}
	if (history.length > MAX_MESSAGES) {
		throw new HistoryError(`A conversation can have at most ${MAX_MESSAGES} messages.`);
	}
	const messages = history.map((message, i) => {
		if (!message || !ROLES.includes(message.role)) {
			throw new HistoryError(`Message ${i + 1}: role must be "user" or "assistant".`);
		}
		if (typeof message.text !== 'string' || !message.text.trim()) {
			throw new HistoryError(`Message ${i + 1}: text is empty.`);
		}
		if (message.text.length > MAX_TEXT_CHARS) {
			throw new HistoryError(`Message ${i + 1} is longer than ${MAX_TEXT_CHARS} characters.`);
		}
		return { role: message.role, text: message.text };
	});

	if (sessionId !== undefined && (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId))) {
		throw new HistoryError('sessionId may contain only letters, digits, "-" and "_" (at most 64).');
	}
	return { messages, sessionId };
}

// The database keeps the existing format, { role, parts: [{ text }] }, so
// nothing already stored needs migrating. These convert to and from it.
const toStored = (messages) => messages.map(({ role, text }) => ({ role, parts: [{ text }] }));

// Older documents may use the app's old name for the assistant ("vega").
const fromStored = (history) =>
	history.map((m) => ({
		role: m.role === 'user' ? 'user' : 'assistant',
		text: (m.parts || []).map((p) => p.text).join(''),
	}));

module.exports = { parseSaveRequest, toStored, fromStored, HistoryError, MAX_MESSAGES, MAX_TEXT_CHARS };
