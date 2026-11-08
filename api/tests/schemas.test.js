import test from 'node:test';
import assert from 'node:assert/strict';
import {usuarioSchema,alterarSenhaSchema} from '../src/schemas.js';
test('novas senhas não podem ser truncadas pelo bcrypt',()=>{
  const usuario={nome:'Pessoa teste',email:'teste@example.invalid'};
  assert.equal(usuarioSchema.safeParse({...usuario,senha:'a'.repeat(72)}).success,true);
  assert.equal(usuarioSchema.safeParse({...usuario,senha:'a'.repeat(73)}).success,false);
  assert.equal(usuarioSchema.safeParse({...usuario,senha:'á'.repeat(40)}).success,false);
  assert.equal(alterarSenhaSchema.safeParse({senhaAtual:'senhaAnterior',senhaNova:'á'.repeat(40)}).success,false);
});
