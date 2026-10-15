import test from 'node:test';
import assert from 'node:assert/strict';
import { serieMortalidadAcumulada } from '../components/03.Detalles por lote/mortalidad-acumulada.js';

test('grafica los porcentajes SQL sin sumar acumulados repetidos por linea ni reiniciarlos', () => {
  const earlier = { ano: 2025, semana: 52, edad: 1, etapa: 'LEVANTE',
    porcentaje_mortalidad_acum_hembra: '1.5', porcentaje_mortalidad_std_acum_hembra: '2',
    porcentaje_mortalidad_acum_macho: '3', porcentaje_mortalidad_std_acum_macho: '4' };
  const later = { ...earlier, ano: 2026, semana: 1, edad: 2, etapa: 'POSTURA',
    porcentaje_mortalidad_acum_hembra: '1.4' };
  const rows = [later, { ...earlier, linea: 'A' }, { ...earlier, linea: 'B' }];
  assert.deepEqual(serieMortalidadAcumulada(rows, 'hembra').map((row) => [row.ano, row.porcentaje, row.estandar]),
    [[2025, 1.5, 2], [2026, 1.4, 2]]);
  assert.deepEqual(serieMortalidadAcumulada(rows, 'macho').map((row) => row.porcentaje), [3, 3]);
});

test('conserva cero real y deja vacios los acumulados o estandares ausentes', () => {
  const rows = [null, '', undefined, 'invalido', 0].map((value, index) => ({
    ano: 2026, semana: index + 1, edad: index + 1,
    porcentaje_mortalidad_acum_hembra: value,
  }));
  const data = serieMortalidadAcumulada(rows, 'hembra');
  assert.deepEqual(data.map((row) => row.porcentaje), [null, null, null, null, 0]);
  assert.ok(data.every((row) => row.estandar === null));
  assert.deepEqual(serieMortalidadAcumulada([], 'hembra'), []);
});
