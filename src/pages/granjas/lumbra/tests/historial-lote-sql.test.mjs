import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { agruparPeriodos } from '../components/03.Detalles por lote/periodos-detalle.js';
const { PGlite } = await import(pathToFileURL(process.env.CSV_PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create schema lumbra;
    create table calendario (fecha date primary key, ano integer, semana integer);
    create table registro_diario_granja (
      "Fecha" date, "Unid_Prod" text, "Linea_Madre" text, "Cod_Lote" text,
      "Sexo" text, "Etapa" text, "Edad_sem" text, "Saldo_Ini" text,
      "Saldo_Final" text, "Mortal" text, "Prod_HInc" numeric, "Prod_HCom" text, "Cons_Alim" text
    );
    create table "Resumen Lotes Cod STD" ("LOTE" text, "COD STD" text);
    create table estandares_pollos (codigo_estandar text, edad_sem integer, sexo text, prod_hinc text, prod_hcom text, mort_sem text);
    insert into calendario values ('2025-12-22',2025,52),('2025-12-23',2025,52),('2025-12-29',2026,1),('2026-01-05',2026,2),('2026-01-06',2026,2);
    insert into registro_diario_granja values
      ('2025-12-22','LUMBRA','CRIOLLO','L1','HEMBRA','LEVANTE','1','100','100','1',0,'0','10'),
      ('2025-12-22','LUMBRA','CRIOLLO','L1','HEMBRA','LEVANTE','1','200','100','2',0,'0','20'),
      ('2025-12-23','LUMBRA','CRIOLLO','L1','HEMBRA','LEVANTE','1','999','100','3',0,'0','30'),
      ('2025-12-22','LUMBRA','CRIOLLO','L1','MACHO','LEVANTE','1','50','49','1',0,'0','5'),
      ('2025-12-29','LUMBRA','CRIOLLO','L1','HEMBRA','LEVANTE','2','90','90','0',0,'0','0'),
      ('2025-12-29','LUMBRA','CRIOLLO','L1','MACHO','LEVANTE','2','40','40','0',0,'0',null),
      ('2026-01-05','LUMBRA','CRIOLLO','L1','HEMBRA','LEVANTE','9','80','80','2',10,'5','40'),
      ('2026-01-06','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','10','60','60','3',20,'10','50'),
      ('2026-01-05','LUMBRA','CRIOLLO','L1','MACHO','LEVANTE','9','40','39','1',0,'0','4'),
      ('2026-01-06','LUMBRA','CRIOLLO','L1','MACHO','POSTURA','10','20','18','2',0,'0','2'),
      ('2025-12-22','LUMBRA','FRANCES','L2','MACHO','LEVANTE','1','60','59','1',0,'0','6'),
      ('2025-12-22','OTRA','CRIOLLO','L1','HEMBRA','LEVANTE','1','100','100','99',99,'99','99');
    insert into "Resumen Lotes Cod STD" values ('L1','STD'),('L1','STD');
    insert into estandares_pollos values ('STD',10,'HEMBRA','0.5','0.1','0.005');
    alter table registro_diario_granja add column "Mortal_Acum" text;
    alter table registro_diario_granja add column "Galpon" text;
    alter table registro_diario_granja add column "Valido" text default 'Y';
    alter table estandares_pollos add column mort_acum text;
  `);
  const sql = readFileSync(new URL('../sql/03_vista_postura_por_lote_y_semana.sql', import.meta.url), 'utf8');
  // Simula ampliar la vista instalada de 22 columnas, con una vista dependiente.
  await db.exec(sql.replace(/,\r?\n  p\.poblacion_edad_1_hembra,[\s\S]*?\r?\nfrom resumen p/, '\nfrom resumen p'));
  await db.exec('create view lumbra.historial_dependiente as select * from lumbra.vista_postura_por_lote_y_semana');
  await db.exec(sql); await db.exec(sql);
  const rows = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='L1' order by ano,semana,etapa")).rows;
  assert.equal(rows.length, 4);
  const periods = agruparPeriodos(rows);
  assert.deepEqual(periods.map((r) => [r.ano,r.semana,r.edad,r.etapa]), [
    [2025,52,'1','LEVANTE'],[2026,1,'2','LEVANTE'],[2026,2,'9','LEVANTE'],[2026,2,'10','POSTURA']
  ]);
  assert.equal(new Set(periods.map((row) => row.periodo)).size, 4, 'el frontend tampoco une las etapas');
  assert.equal(Number(rows[0].saldo_inicial_hembra), 150);
  assert.equal(Number(rows[0].saldo_inicial_macho), 50);
  assert.equal(Number(rows[0].mortalidad_hembra), 6);
  assert.equal(Number(rows[0].mortalidad_macho), 1);
  assert.equal(Number(rows[0].prod_hinc), 0);
  assert.equal(Number(rows[2].prod_hinc), 10);
  assert.equal(Number(rows[2].prod_hcom), 5);
  assert.equal(Number(rows[3].prod_hinc), 20);
  assert.equal(Number(rows[3].prod_hcom), 10);
  assert.equal(Number(rows[3].prod_hinc_std), 50);
  assert.equal(Number(rows[3].prod_hcom_std), 10);
  assert.equal(rows[0].etapa, 'LEVANTE');
  assert.equal(rows[2].etapa, 'LEVANTE');
  assert.equal(rows[3].etapa, 'POSTURA');
  assert.equal(Number(rows[2].saldo_inicial_hembra), 80);
  assert.equal(Number(rows[3].saldo_inicial_hembra), 60, 'usa la primera fecha de POSTURA, aunque LEVANTE empiece antes');
  assert.equal(Number(rows[2].saldo_inicial_macho), 40);
  assert.equal(Number(rows[3].saldo_inicial_macho), 20);
  assert.equal(Number(rows[2].saldo_final_hembra), 80);
  assert.equal(Number(rows[3].saldo_final_hembra), 60);
  assert.equal(Number(rows[2].mortalidad_hembra), 2);
  assert.equal(Number(rows[3].mortalidad_hembra), 3);
  assert.equal(Number(rows[2].mortalidad_macho), 1);
  assert.equal(Number(rows[3].mortalidad_macho), 2);
  assert.equal(Number(rows[2].porcentaje_mortalidad_hembra), 2.5);
  assert.equal(Number(rows[3].porcentaje_mortalidad_hembra), 5);
  assert.equal(Number(rows[2].porcentaje_mortalidad_macho), 2.5);
  assert.equal(Number(rows[3].porcentaje_mortalidad_macho), 10);
  assert.equal(Number(rows[3].porcentaje_mortalidad_std_sem_hembra), 0.5);
  const columns = (await db.query("select column_name from information_schema.columns where table_schema='lumbra' and table_name='vista_postura_por_lote_y_semana' order by ordinal_position")).rows;
  assert.equal(columns.length,30);
  assert.equal(columns[21].column_name,'etapa');
  assert.equal((await db.query('select * from lumbra.historial_dependiente limit 1')).fields.length, 22);
  // Proporciones y texto exportado desde Excel deben usar la misma escala.
  const formats = [
    ['0.85', 85], ['0,85', 85], ['85.00%', 85], ['85,00 %', 85],
    ['0.005', 0.5], ['0,005', 0.5], ['0.50%', 0.5], ['0,50%', 0.5],
    ['0.0236', 2.36], ['2.36%', 2.36], ['\u00a02,36 %\u00a0', 2.36],
    ['0', 0], ['0.00%', 0], ['1', 100], ['1%', 1], ['0.5%', 0.5], ['0.5', 50],
    ['5e-3', 0.5], ['2.36e0%', 2.36], ['-0.005', -0.5], ['-0.5%', -0.5],
    [null, null], ['', null], ['   ', null], ['-', null], ['Sin dato', null],
    ['abc0.85', null], ['2%%', null], ['1,2.3', null], ['1 2%', null],
  ];
  for (const [value, expected] of formats) {
    const actual = (await db.query('select lumbra.estandar_a_porcentaje($1) as valor', [value])).rows[0].valor;
    assert.equal(actual == null ? null : Number(actual), expected, `formato ${value}`);
  }
  // Muestra BARRADO F1: los porcentajes no se multiplican una segunda vez.
  const barrado = ['2.36%', '0.99%', '0.80%', '0.75%', '0.55%', '0.31%', '0.28%', '0.25%', '0.21%', '0.20%', '0.20%'];
  const converted = (await db.query(`select lumbra.estandar_a_porcentaje(valor) as valor
    from unnest($1::text[]) with ordinality as datos(valor, orden) order by orden`, [barrado])).rows;
  assert.deepEqual(converted.map(row => Number(row.valor)), [2.36, 0.99, 0.8, 0.75, 0.55, 0.31, 0.28, 0.25, 0.21, 0.2, 0.2]);
  await db.exec(`
    update estandares_pollos set prod_hinc='85.00%', prod_hcom='0.50%', mort_sem='2.36%', mort_acum='6.90%'
      where codigo_estandar='STD' and edad_sem=10 and sexo='HEMBRA';
    insert into estandares_pollos (codigo_estandar, edad_sem, sexo, mort_sem, mort_acum)
      values ('STD',10,'MACHO','0.99%','3.35%');
  `);
  const percentRows = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='L1' order by ano,semana,etapa")).rows;
  const percentRow = percentRows[3];
  assert.equal(Number(percentRow.prod_hinc_std), 85);
  assert.equal(Number(percentRow.prod_hcom_std), 0.5);
  assert.equal(Number(percentRow.porcentaje_mortalidad_std_sem_hembra), 2.36);
  assert.equal(Number(percentRow.porcentaje_mortalidad_std_sem_macho), 0.99);
  assert.equal(Number(percentRow.porcentaje_mortalidad_std_acum_hembra), 6.9);
  assert.equal(Number(percentRow.porcentaje_mortalidad_std_acum_macho), 3.35);
  const realOnly = row => Object.fromEntries(Object.entries(row).filter(([key]) => !key.includes('std')));
  assert.deepEqual(percentRows.map(realOnly), rows.map(realOnly), 'corregir la escala estandar no cambia medidas reales');
  await db.exec(`update estandares_pollos set prod_hinc='85,00%', prod_hcom='0,50%', mort_sem='2,36%', mort_acum='6,90%'
    where codigo_estandar='STD' and edad_sem=10 and sexo='HEMBRA'`);
  assert.deepEqual((await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='L1' order by ano,semana,etapa")).rows,
    percentRows, 'el separador decimal no modifica los porcentajes');
  await db.exec(`update estandares_pollos set prod_hinc=null, prod_hcom='-', mort_sem='' where sexo='HEMBRA'`);
  const missing = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='L1' and etapa='POSTURA'")).rows[0];
  assert.equal(missing.prod_hinc_std, null);
  assert.equal(missing.prod_hcom_std, null);
  assert.equal(missing.porcentaje_mortalidad_std_sem_hembra, null);
  console.log('PASS: historial desde edad 1; etapas separadas en SQL y frontend; saldos, primera fecha, producción y mortalidad independientes para ambos sexos.');
  console.log('PASS: estándares con porcentaje explícito, proporciones, punto/coma, nulos y muestra BARRADO F1; reales sin cambios.');
} finally { await db.close(); }
