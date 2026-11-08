// Os testes encerram a API por sinal. Grave os contadores V8 antes de sair.
import {takeCoverage} from 'node:v8';
process.once('SIGTERM',()=>{
  if (process.env.NODE_V8_COVERAGE) takeCoverage();
  process.exit(0);
});
await import('../src/server.js');
