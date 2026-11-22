/** Give or remove Tech Admin rights: npm run admin:grant -- username [--remove]. */
import { db } from './lib/db'
async function main(){const username=(process.argv[2]??'').replace(/^@/,'').toLowerCase(),remove=process.argv.includes('--remove');if(!username)throw new Error('Usage: npm run admin:grant -- username [--remove]');const{data,error}=await db.rpc('papa_cli_grant_admin',{p_username:username,p_remove:remove});if(error)throw new Error(error.message);if(!data)throw new Error(`No account with username @${username}`);const result=data as{name:string};console.log(`✓ ${result.name} (@${username}) is ${remove?'no longer':'now'} a Tech Admin.`)}
main().catch(e=>{console.error(`✗ ${e.message}`);process.exitCode=1})
