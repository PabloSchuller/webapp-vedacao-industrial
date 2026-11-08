import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const cwd = fileURLToPath(new URL('../',import.meta.url));
const secret = () => randomBytes(32).toString('hex');
const env = {...process.env, TEST_DB_PASSWORD:secret(), TEST_OWNER_PASSWORD:secret(),
  TEST_EMPLOYEE_PASSWORD:secret(), TEST_JWT_SECRET:secret()};
const project = 'vedacao-ci-' + randomBytes(6).toString('hex');
function compose(...args) {
  const r = spawnSync('docker',['compose','-p',project,'-f','docker-compose.test.yml',...args],{cwd,env,stdio:'inherit'});
  if (r.error || r.status !== 0) throw new Error('Falha em docker compose ' + args.join(' '),{cause:r.error});
}
for (const path of ['api','web']) mkdirSync(new URL('../'+path+'/coverage/',import.meta.url),{recursive:true});
try {
  compose('build','api','web','ia');
  compose('up','-d','--wait','--wait-timeout','120','postgres','ia');
  compose('exec','-T','ia','python','-m','pytest','-q','-p','no:cacheprovider','tests','/avaliacao/tests');
  compose('run','--rm','--no-deps','api','sh','-ec','npm run lint && npx prisma migrate deploy && npm run db:seed && npm run coverage');
  compose('run','--rm','--no-deps','web','sh','-ec','npm run lint && npm test && npm run coverage && npm run build');
} finally {
  compose('down');
}
