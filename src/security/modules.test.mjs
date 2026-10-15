import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAccess, filterNavigation, moduleForPath } from './modules.js';
test('permisos de lectura/edicion, administrador y usuario desactivado', () => {
  const access = { active: true, is_admin: false, permissions: { asia: 'read', lumbra: 'edit' } };
  assert.equal(hasAccess(access,'asia'),true);
  assert.equal(hasAccess(access,'asia','edit'),false);
  assert.equal(hasAccess(access,'lumbra','edit'),true);
  assert.equal(hasAccess(access,'carabayllo'),false);
  assert.equal(hasAccess(access,'administracion'),false);
  assert.equal(hasAccess({ ...access, is_admin: true },'administracion'),true);
  assert.equal(hasAccess({ ...access, active: false, is_admin: true },'asia'),false);
});
test('menu no expone modulos o enlaces padre sin permiso', () => {
  const items = [{ label:'Granjas', path:'/granjas-aves',children:[{ path:'/granjas-aves/asia' },{ path:'/granjas-aves/lumbra' }] }, { path:'/administracion' }];
  const result = filterNavigation(items,(module) => module==='asia');
  assert.equal(result.length,1);
  assert.equal(result[0].path,'/granjas-aves/asia');
  assert.equal(result[0].children.length,1);
  assert.equal(moduleForPath('/incubacion/ate'),'ate');
});
