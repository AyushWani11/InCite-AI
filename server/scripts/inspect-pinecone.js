// Read-only: prints your Pinecone index's settings and how many records each
// namespace holds. It changes nothing and never prints the API key.
//
// Usage (from the server/ folder, with PINECONE_API_KEY and
// PINECONE_INDEX_NAME set in server/.env):
//   node scripts/inspect-pinecone.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function main() {
	const apiKey = process.env.PINECONE_API_KEY;
	const indexName = process.env.PINECONE_INDEX_NAME;
	if (!apiKey || !indexName) {
		throw new Error('Set PINECONE_API_KEY and PINECONE_INDEX_NAME in server/.env');
	}

	const pc = new Pinecone({ apiKey });
	const info = await pc.describeIndex(indexName);

	console.log(`Index:      ${info.name}`);
	console.log(`Dimension:  ${info.dimension}`);
	console.log(`Metric:     ${info.metric}`);
	console.log(`Type:       ${info.vectorType}`);
	console.log(`Status:     ${info.status?.state}`);
	console.log(`Hosting:    ${JSON.stringify(info.spec)}`);
	if (info.embed) {
		console.log('Integrated embedding (Pinecone embeds text for you):');
		console.log(`  model:     ${info.embed.model}`);
		console.log(`  field map: ${JSON.stringify(info.embed.fieldMap)}`);
	} else {
		console.log('Integrated embedding: none (the app must send its own vectors)');
	}

	const stats = await pc.index(indexName).describeIndexStats();
	console.log(`\nRecords in total: ${stats.totalRecordCount ?? 0}`);
	for (const [ns, s] of Object.entries(stats.namespaces || {})) {
		console.log(`  namespace "${ns || '(default)'}": ${s.recordCount} records`);
	}
}

main().catch((err) => {
	console.error('Failed:', err.message);
	process.exit(1);
});
