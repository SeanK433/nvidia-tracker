// scripts/validate-data.ts
import { loadRelationships, loadPending } from '../src/lib/data';

try {
  const rels = loadRelationships();
  const pending = loadPending();
  console.log(`✓ relationships.json valid (${rels.length} entries)`);
  console.log(`✓ pending.json valid (${pending.length} entries)`);
  process.exit(0);
} catch (err) {
  console.error('✗ Data validation failed:');
  console.error(err);
  process.exit(1);
}
