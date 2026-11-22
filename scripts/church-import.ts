/** Import/update the church register from CSV: npm run church:import -- members.csv */
import { readFile } from 'node:fs/promises'
import { db } from './lib/db'
import { parseRegisterCsv, upsertRegister } from '../db/register-ops'
async function main(){const file=process.argv[2];if(!file)throw new Error('Usage: npm run church:import -- members.csv');const parsed=parseRegisterCsv(await readFile(file,'utf8'));if(parsed.fatal)throw new Error(parsed.fatal);const r=await upsertRegister(db,parsed.records);console.log(`✓ ${r.added} added, ${r.updated} updated, ${parsed.problems.length} skipped.`);parsed.problems.slice(0,50).forEach(p=>console.log(`  - ${p}`))}
main().catch(e=>{console.error(`✗ ${e.message}`);process.exitCode=1})
