import test from 'node:test';
import assert from 'node:assert/strict';
import { esPosturaPollo } from '../components/etapas.js';

test('acepta POSTURA - POLLO de Supabase y variantes de espacios y mayúsculas', () => {
  for (const stage of ['POSTURA - POLLO', 'POSTURA-POLLO', ' postura - pollo ', 'POSTURA  -  POLLO']) {
    assert.equal(esPosturaPollo(stage), true, stage);
  }
});

test('excluye levante, otras especies, etapas mezcladas y valores ausentes', () => {
  for (const stage of ['LEVANTE - POLLO', 'POSTURA - PAVO', 'POSTURA', 'POSTURA - POLLO / MUDA', null, undefined, '']) {
    assert.equal(esPosturaPollo(stage), false, String(stage));
  }
});
