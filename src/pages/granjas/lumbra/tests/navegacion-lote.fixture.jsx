import React from 'react';
import { create, act } from 'react-test-renderer';
import assert from 'node:assert/strict';
import Lumbra from '../Lumbra.jsx';

export async function verifyNavigation() {
  const rows = ['CRIOLLO', 'BARRADO'].map(linea => ({
    linea, lote: 'L01', etapa: 'POSTURA - POLLO', edad: '30', edad_lote: 30,
    saldo_final_hembras: 100, saldo_final_machos: 20,
    porcentaje_prod_hinc: 80, porcentaje_prod_hcom: 5, prod_hinc_std: 82, prod_hcom_std: 4,
    porcentaje_mortalidad_hembra: 0.5, porcentaje_mortalidad_macho: 0.7,
    porcentaje_mortalidad_std_sem_hembra: 0.4, porcentaje_mortalidad_std_sem_macho: 0.6,
    consumo_kg_hembra: 10, consumo_kg_macho: 5,
    saldo_inicial_hembra: 100, saldo_inicial_macho: 20,
    suma_saldos_diarios_hembra: 700, suma_saldos_diarios_macho: 140,
    dias_registrados_hembra: 7, dias_registrados_macho: 7,
    consumo_std_kg_hembra: 84, consumo_std_kg_macho: 8.4,
    consumo_std_g_ave_dia_hembra: 120, consumo_std_g_ave_dia_macho: 60,
    alimentos_hembra: [{ alimento: 'A', kg: 6 }, { alimento: 'B', kg: 4 }],
    alimentos_macho: [{ alimento: 'A', kg: 5 }],
    alimentos_std_hembra: [{ alimento: 'A', kg: 84, g_ave_dia: 120 }],
    alimentos_std_macho: [{ alimento: 'B', kg: 8.4, g_ave_dia: 60 }],
  }));
  let resolveCatalog;
  const catalog = new Promise(resolve => { resolveCatalog = resolve; });
  globalThis.__loteTestDatabase = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; }, ilike() { return query; },
        order() { return query; }, range() { return query; }, abortSignal() { return query; },
        then(resolve, reject) {
          return (table === 'resumen_especie_linea_lote_lumbra' ? catalog : Promise.resolve({ data: rows, error: null })).then(resolve, reject);
        },
      };
      return query;
    },
  };
  let app;
  const tab = (label) => app.root.findAllByType('button').find(node => node.children[0] === label);
  const assertDetail = (linea, lote) => {
    assert.equal(tab('Detalle por lote').props.className, 'active');
    const charts = app.root.findAllByType('detail-chart');
    assert.equal(charts.length, 6);
    charts.forEach(chart => {
      assert.equal(chart.props.linea, linea);
      assert.equal(chart.props.lote, lote);
    });
  };
  try {
    await act(async () => { app = create(<Lumbra />); });
    const dailyCharts = app.root.findAllByType('chart').slice(-2);
    assert.ok(Math.abs(dailyCharts[0].props.data[0].total - 100 / 7) < 1e-10);
    assert.ok(Math.abs(dailyCharts[1].props.data[0].total - 250 / 7) < 1e-10);
    assert.equal(dailyCharts[0].props.data[0].standardTotal, 120);
    assert.equal(dailyCharts[1].props.data[0].standardTotal, 60);
    assert.equal(app.root.findAllByType('strong').filter(node => node.children.some(text => typeof text === 'string' && text.includes('g/ave/día'))).length, 2);
    const bars = app.root.findAllByType('bar');
    // Aves (2), postura (4), mortalidad (4), alimentos reales/estándar (5).
    assert.equal(bars.length, 15);
    assert.ok(bars.every(bar => typeof bar.props.onClick === 'function'));
    await act(async () => bars[0].props.onClick({ payload: rows[0] }));
    assertDetail('CRIOLLO', 'L01');
    // El catálogo llega después del clic y no contiene el lote seleccionado.
    // No debe borrar el filtro ni dejar los selects mostrando otra opción.
    await act(async () => resolveCatalog({ data: [{ linea: 'OTRA', cod_lote: 'L99' }], error: null }));
    assertDetail('CRIOLLO', 'L01');
    assert.equal(app.root.findByProps({ id: 'postura-linea' }).props.value, 'CRIOLLO');
    const lotSelect = app.root.findByProps({ id: 'postura-lote' });
    assert.equal(lotSelect.props.value, 'L01');
    assert.ok(lotSelect.findAllByType('option').some(option => option.props.value === 'L01'));
    // Todos los gráficos, sexos y barras de estándar abren el lote exacto.
    for (let index = 0; index < bars.length; index++) {
      await act(async () => tab('Datos generales').props.onClick());
      const target = rows[index % 2];
      await act(async () => app.root.findAllByType('bar')[index].props.onClick({ payload: target }));
      assertDetail(target.linea, target.lote);
    }
    await act(async () => tab('Datos generales').props.onClick());
    const labels = app.root.findAll(node => node.type === 'g' && node.props.role === 'button');
    assert.equal(labels.length, 14, 'dos lotes en cada uno de los siete gráficos');
    for (const label of labels) {
      await act(async () => tab('Datos generales').props.onClick());
      await act(async () => label.props.onClick());
      assertDetail(label.props['aria-label'].endsWith('BARRADO') ? 'BARRADO' : 'CRIOLLO', 'L01');
    }
    for (const key of ['Enter', ' ']) {
      await act(async () => tab('Datos generales').props.onClick());
      let prevented = false;
      await act(async () => labels[1].props.onKeyDown({ key, preventDefault() { prevented = true; }, stopPropagation() {} }));
      assert.equal(prevented, true);
      assertDetail('BARRADO', 'L01');
    }
    // El selector manual sigue controlando todos los gráficos del detalle.
    await act(async () => app.root.findByProps({ id: 'postura-linea' }).props.onChange({ target: { value: 'OTRA' } }));
    assert.equal(app.root.findAllByType('detail-chart').length, 0);
    await act(async () => app.root.findByProps({ id: 'postura-lote' }).props.onChange({ target: { value: 'L99' } }));
    assertDetail('OTRA', 'L99');
    await act(async () => tab('Datos generales').props.onClick());
    await act(async () => tab('Detalle por lote').props.onClick());
    assertDetail('OTRA', 'L99');
    await act(async () => tab('Datos generales').props.onClick());
    await act(async () => app.root.findAllByType('bar')[0].props.onClick({ payload: {} }));
    assert.equal(tab('Datos generales').props.className, 'active', 'un payload vacío no navega');
    await act(async () => tab('Consumo de alimento').props.onClick());
    const weeklyCharts = app.root.findAllByType('chart').slice(-2);
    assert.equal(weeklyCharts[0].props.data[0].total, 10);
    assert.equal(weeklyCharts[0].props.data[0].standardTotal, 84);
    assert.equal(weeklyCharts[1].props.data[0].total, 5);
    assert.equal(weeklyCharts[1].props.data[0].standardTotal, 8.4);
    console.log('PASS: 15 series y 14 etiquetas abren Detalle por lote con línea/lote correctos; teclado, catálogo tardío y filtros manuales.');
    console.log('PASS: Datos generales compara g/ave/día para ambos sexos; Consumo de alimento conserva kg semanales.');
  } finally {
    if (app) await act(async () => app.unmount());
    delete globalThis.__loteTestDatabase;
  }
}
