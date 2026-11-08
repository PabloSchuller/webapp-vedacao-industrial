import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

if (new URL(process.env.DATABASE_URL).pathname !== '/vedacao_test') throw new Error('Exige banco isolado');
const api = spawn(process.execPath,['tests/servidor-cobertura.mjs'],{stdio:'inherit'});
const closed = once(api,'close');
try {
  let ready = false;
  for (let i=0;i<100 && !ready;i++) {
    if (api.exitCode !== null) throw new Error('API encerrou antes do teste');
    ready = await fetch('http://127.0.0.1:3001/saude').then(r=>r.ok).catch(()=>false);
    if (!ready) await delay(100);
  }
  if (!ready) throw new Error('API indisponível');
  const tests = spawn(process.execPath,['--test','tests/*.test.js','tests/integration/*.test.js'],{stdio:'inherit'});
  const [code] = await once(tests,'close');
  process.exitCode = code ?? 1;
} finally {
  api.kill('SIGTERM');
  await closed;
}
