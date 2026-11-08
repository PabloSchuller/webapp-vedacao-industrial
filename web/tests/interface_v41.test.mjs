import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const interfaceCode=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const serverCode=readFileSync(new URL('../../api/src/server.js',import.meta.url),'utf8');

test('menu principal não oferece telas acadêmicas nem troca de senha',()=>{
  assert.doesNotMatch(interfaceCode,/\['avaliacao'|\['seguranca'|function AvaliacaoTcc\(|function MinhaSenha\(/);
  assert.match(interfaceCode,/\['galpoes',Warehouse,'Galpões'\]/);
});
test('mudança de senha está na tela de login e exige senha atual',()=>{
  const inicio=interfaceCode.indexOf('function Login({onLogin})');
  const fim=interfaceCode.indexOf('function Dashboard(',inicio);
  const login=interfaceCode.slice(inicio,fim);
  assert.match(login,/Alterar minha senha/);
  assert.match(login,/email,senha/);
  assert.match(login,/request\('\/auth\/login'/);
  assert.match(login,/request\('\/auth\/senha'/);
  assert.match(login,/senhaAtual:senha,senhaNova/);
  assert.match(login,/senhaNova!==confirmacao/);
  assert.match(login,/setSucesso\('Senha atualizada/);
});
test('API mantém verificação de senha atual e revogação de sessões',()=>{
  assert.match(serverCode,/bcrypt\.compare\(d\.senhaAtual,u\.senhaHash\)/);
  assert.match(serverCode,/tokenVersao:\{increment:1\}/);
});
test('API não expõe endpoints de avaliação acadêmica',()=>{
  assert.doesNotMatch(serverCode,/app\.(?:get|post|delete|put|patch)\('\/avaliacoes/);
});
