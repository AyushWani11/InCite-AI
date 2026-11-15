// Read a readable error message from a failed API response. The server
// answers with { msg }, { error } or, for validation, { errors: [{ msg }] }.
export async function readError(res: Response, fallback: string): Promise<string> {
	const data = await res.json().catch(() => null);
	if (Array.isArray(data?.errors) && data.errors.length) {
		return data.errors.map((e: { msg?: string }) => e.msg).filter(Boolean).join(' ');
	}
	return data?.msg || data?.error || fallback;
}

// A message for a request that failed before any response (server down,
// offline, or still waking up).
export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";

export function messageOf(err: unknown, fallback: string): string {
	if (err instanceof TypeError) return NETWORK_ERROR; // fetch() network failure
	return err instanceof Error && err.message ? err.message : fallback;
}
