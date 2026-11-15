// Small helpers for running external calls safely.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run fn over items with at most `limit` calls in flight; results keep the
 * input order. If a call fails, no new calls are started, the ones already
 * running are allowed to finish, and then the first error is thrown. (So a
 * caller cleaning up after a failure never races a write still in flight.)
 */
async function mapWithLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	let firstError = null;
	async function worker() {
		while (next < items.length && !firstError) {
			const i = next++;
			try {
				results[i] = await fn(items[i], i);
			} catch (err) {
				firstError ??= err;
			}
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	if (firstError) throw firstError;
	return results;
}

/**
 * Errors from Pinecone worth retrying ourselves. The SDK already retries
 * 500/503 internally (3 attempts), so retrying those again would only
 * multiply the wait. It does not retry rate limits (429, which it reports as
 * PineconeUnmappedHttpError) or network failures, so those are retried here.
 */
function isTransientPineconeError(err) {
	if (!err) return false;
	if (err.name === 'PineconeConnectionError' || err.name === 'PineconeRequestError') return true;
	return (
		err.name === 'PineconeUnmappedHttpError' &&
		(err.status === 429 || /Status: 429\b/.test(err.message || ''))
	);
}

function retryBaseDelayMs() {
	return Number(process.env.RETRY_BASE_DELAY_MS) || 2000;
}

/**
 * Call fn; if it fails with a transient error, wait and try again, up to
 * `attempts` times in total, doubling the wait each time (2 s, 4 s, ...).
 * Other errors are thrown immediately.
 */
async function withRetry(fn, { attempts = 3, isRetryable = isTransientPineconeError, label = 'call' } = {}) {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt >= attempts || !isRetryable(err)) throw err;
			const delay = retryBaseDelayMs() * 2 ** (attempt - 1);
			console.warn(`${label}: ${err.name} (attempt ${attempt} of ${attempts}), retrying in ${delay} ms`);
			await sleep(delay);
		}
	}
}

module.exports = { mapWithLimit, withRetry, isTransientPineconeError, sleep };
