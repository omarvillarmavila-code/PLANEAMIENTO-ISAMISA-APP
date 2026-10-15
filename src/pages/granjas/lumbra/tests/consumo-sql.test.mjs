import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildConsumptionChart } from '../components/01.Datos_generales/consumo-por-lote.js';
const modulePath = process.env.CSV_PGLITE_MODULE;
const { PGlite } = await import(modulePath ? pathToFileURL(modulePath).href : '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create schema lumbra;
    create table public.calendario (fecha date primary key, ano integer, semana integer);
    create table public.registro_diario_granja (
      "Fecha" date, "Unid_Prod" text, "Linea_Madre" text, "Cod_Lote" text,
      "Sexo" text, "Etapa" text, "Edad_sem" text, "Saldo_Final" text,
      "Tipo_Alim" text, "Cons_Alim" text
    );
    create table public."Resumen Lotes Cod STD" ("LOTE" text, "COD STD" text);
    create table public.estandares_pollos (
      codigo_estandar text, edad_sem integer, sexo text, tipo_aabb text, cons_aabb text
    );
    insert into calendario values ('2026-06-15',2026,25),('2026-06-16',2026,25),('2026-06-22',2026,26),('2025-06-16',2025,25);
    insert into registro_diario_granja values
      ('2026-06-15','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','29','1000','A','10'),
      ('2026-06-15','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','29','1000','B','20'),
      ('2026-06-16','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','30','990','A','30'),
      ('2026-06-15','LUMBRA','CRIOLLO','L1','MACHO','POSTURA','29','100','C','5'),
      ('2026-06-16','LUMBRA','CRIOLLO','L1','MACHO','POSTURA','30','98','C','7'),
      ('2026-06-16','LUMBRA','ISAMISA','L2','HEMBRA','LEVANTE','5','80','INICIO','0'),
      ('2026-06-16','LUMBRA','FRANCES','L3','MACHO','MUDA','30','100','C','-5'),
      ('2026-06-16','LUMBRA','BARRADO','L4','HEMBRA','POSTURA','30','100','A',null),
      ('2026-06-16','LUMBRA','BARRADO','L4','HEMBRA','POSTURA','30','100','A','10'),
      ('2026-06-16','LUMBRA','BARRADO','L5','HEMBRA','POSTURA','30','100','A','1,234.50'),
      ('2026-06-16','LUMBRA','DEKALB','L6','HEMBRA','POSTURA','30','100','A','10'),
      ('2026-06-22','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','31','900','A','9999'),
      ('2025-06-16','LUMBRA','CRIOLLO','L1','HEMBRA','POSTURA','20','500','A','11'),
      ('2026-06-16','ASIA','CRIOLLO','L1','HEMBRA','POSTURA','30','500','A','8888');
    insert into "Resumen Lotes Cod STD" values ('L1','S1'),('L1','S1'),('L2','S2'),('L3','S3'),('L5','S1'),('L5','S2'),('L6','S6');
    insert into estandares_pollos values
      ('S1',29,'HEMBRA','ANTERIOR','900'),
      ('S1',30,'HEMBRA','D','120'),('S1',30,'HEMBRA','D','120'),
      ('S1',30,'MACHO','E','40'),
      ('S1',31,'HEMBRA','D','150'),
      ('S2',5,'HEMBRA','INICIO','0'),
      ('S3',30,'MACHO','C','100'),('S3',30,'MACHO','C','110'),
      ('S6',30,'HEMBRA','A','70'),('S6',30,'HEMBRA','B','30');
    alter table registro_diario_granja add column "Saldo_Ini" text;
    update registro_diario_granja set "Saldo_Ini" = "Saldo_Final";
    update registro_diario_granja set "Saldo_Ini" = '1200'
      where "Cod_Lote"='L1' and "Sexo"='HEMBRA' and "Fecha"='2026-06-15' and "Tipo_Alim"='B';
    update registro_diario_granja set "Saldo_Ini" = '1080'
      where "Cod_Lote"='L1' and "Sexo"='HEMBRA' and "Fecha"='2026-06-16';
    update registro_diario_granja set "Saldo_Ini" = null where "Cod_Lote"='L4';
  `);
  await db.exec(readFileSync(new URL('../sql/02_vista_poblacion_por_lote_y_semana.sql', import.meta.url), 'utf8'));
  const setup = readFileSync(new URL('../sql/04_vista_Consumo_por_lote_semanal.sql', import.meta.url), 'utf8');
  await db.exec(setup); await db.exec(setup);
  const { rows } = await db.query('select * from lumbra.vista_consumo_por_lote_semanal where ano=2026 and semana=25 order by lote');
  assert.equal(rows.length, 6);
  const [l1, l2, l3, l4, l5, l6] = rows;
  assert.deepEqual(l1.alimentos_hembra, [{ alimento: 'A', kg: 40 }, { alimento: 'B', kg: 20 }]);
  assert.deepEqual(l1.alimentos_macho, [{ alimento: 'C', kg: 12 }]);
  assert.equal(Number(l1.consumo_kg_hembra), 60); assert.equal(Number(l1.consumo_kg_macho), 12);
  assert.equal(Number(l1.saldo_final_hembras), 990); assert.equal(Number(l1.saldo_final_machos), 98);
  assert.equal(Number(l1.total_aves), 1088);
  assert.equal(Number(l1.saldo_inicial_hembra), 1100); assert.equal(Number(l1.saldo_inicial_macho), 100);
  assert.equal(Number(l1.consumo_std_kg_hembra), 924); assert.equal(Number(l1.consumo_std_kg_macho), 28);
  assert.equal(Number(l1.consumo_std_g_ave_dia_hembra), 120);
  assert.equal(l1.suma_saldos_diarios_hembra, null, 'saldos contradictorios del mismo día/galpón no se promedian');
  assert.equal(Number(l1.suma_saldos_diarios_macho), 198);
  assert.equal(Number(l1.dias_registrados_hembra), 2);
  assert.equal(Number(l1.dias_registrados_macho), 2);
  assert.deepEqual(l1.alimentos_std_hembra, [{ alimento: 'D', kg: 924, g_ave_dia: 120 }]);
  assert.deepEqual(l1.alimentos_std_macho, [{ alimento: 'E', kg: 28, g_ave_dia: 40 }]);
  assert.equal(Number(l2.consumo_kg_hembra), 0); assert.equal(Number(l2.consumo_std_kg_hembra), 0);
  assert.equal(l2.consumo_kg_macho, null); assert.deepEqual(l2.alimentos_macho, []);
  assert.equal(Number(l3.consumo_kg_macho), -5); assert.equal(l3.consumo_std_kg_macho, null);
  assert.equal(l4.consumo_kg_hembra, null); assert.equal(l4.consumo_std_kg_hembra, null);
  assert.equal(Number(l5.consumo_kg_hembra), 1234.5); assert.equal(l5.cod_std, null);
  assert.equal(l5.consumo_std_kg_hembra, null);
  assert.equal(Number(l6.consumo_std_kg_hembra), 70);
  assert.deepEqual(l6.alimentos_std_hembra, [{ alimento: 'A', kg: 49, g_ave_dia: 70 }, { alimento: 'B', kg: 21, g_ave_dia: 30 }]);
  await db.exec(`
    insert into "Resumen Lotes Cod STD" values ('L7','S1'),('L8','S1'),('L9','S1');
    insert into registro_diario_granja values
      ('2026-06-15','LUMBRA','CRIOLLO','L7','HEMBRA','POSTURA','30','100','A','1','100'),
      ('2026-06-16','LUMBRA','CRIOLLO','L7','MACHO','POSTURA','30','30','C','1','30'),
      ('2026-06-15','LUMBRA','CRIOLLO','L8','HEMBRA','POSTURA','30','100','A','1',null),
      ('2026-06-16','LUMBRA','CRIOLLO','L8','HEMBRA','POSTURA','30','80','A','1','80'),
      ('2026-06-15','LUMBRA','CRIOLLO','L9','HEMBRA','POSTURA','30','100','A','1','0'),
      ('2026-06-16','LUMBRA','CRIOLLO','L9','HEMBRA','POSTURA','30','100','A','1','100');
  `);
  const checks = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote in ('L7','L8','L9') order by lote")).rows;
  assert.equal(Number(checks[0].saldo_inicial_hembra), 100); assert.equal(Number(checks[0].saldo_inicial_macho), 30);
  assert.equal(Number(checks[0].consumo_std_kg_macho), 8.4);
  assert.equal(checks[1].saldo_inicial_hembra, null); assert.equal(checks[1].consumo_std_kg_hembra, null);
  assert.equal(Number(checks[1].consumo_std_g_ave_dia_hembra), 120);
  assert.equal(checks[1].alimentos_std_hembra[0].kg, null);
  assert.equal(Number(checks[2].saldo_inicial_hembra), 0); assert.equal(Number(checks[2].consumo_std_kg_hembra), 0);
  await db.exec(`insert into registro_diario_granja values
    ('2026-06-15','LUMBRA','CRIOLLO','L10','HEMBRA','POSTURA','30','100','A','1','100'),
    ('2026-06-15','LUMBRA','CRIOLLO','L10','HEMBRA','POSTURA','30','100','A','1','100'),
    ('2026-06-15','LUMBRA','CRIOLLO','L10','HEMBRA','POSTURA','30','100','B','1','200'),
    ('2026-06-16','LUMBRA','CRIOLLO','L10','HEMBRA','POSTURA','30','100','B','1','9999');`);
  const weighted = (await db.query("select saldo_inicial_hembra from lumbra.vista_consumo_por_lote_semanal where lote='L10'")).rows[0];
  assert.equal(Number(weighted.saldo_inicial_hembra), 150,
    'promedia los registros distintos de la primera fecha sin ponderar las copias de una carga');
  // Reproduce el salto de 24PI17: una copia en diciembre y cuatro desde enero.
  await db.exec(`
    alter table registro_diario_granja add column id bigint generated always as identity;
    alter table registro_diario_granja add column created_at timestamptz;
    alter table registro_diario_granja add column "Galpon" text;
    alter table registro_diario_granja add column "Valido" text;
    insert into calendario
      select fecha::date, 2025, case when fecha < '2025-01-05' then 1 else 2 end
      from generate_series('2024-12-29'::date,'2025-01-11'::date,'1 day') fecha;
    insert into registro_diario_granja
      ("Fecha","Unid_Prod","Linea_Madre","Cod_Lote","Sexo","Etapa","Edad_sem",
       "Saldo_Final","Tipo_Alim","Cons_Alim","Saldo_Ini","Galpon","Valido",created_at)
      select fecha::date, 'LUMBRA', 'ISAMISA', '24PI17', sexo, 'LEVANTE - POLLO',
        case when fecha < '2025-01-05' then '18' else '19' end,
        case when sexo = 'HEMBRA' then '2912' else '467' end, 'LPO3',
        case when sexo = 'HEMBRA' then case when fecha <= '2025-01-01' then '193' else '204' end
          else case when fecha <= '2025-01-01' then '51' else '53' end end,
        case when sexo = 'HEMBRA' then '2912' else '467' end, 'S.E.', 'Y',
        '2026-01-01'::timestamptz + copia * interval '1 hour'
      from generate_series('2024-12-29'::date,'2025-01-11'::date,'1 day') fecha
      cross join (values ('HEMBRA'),('MACHO')) sexos(sexo)
      cross join lateral generate_series(1, case when fecha < '2025-01-01' then 1 else 4 end) copia;
  `);
  const corregidos = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote='24PI17' order by semana")).rows;
  assert.deepEqual(corregidos.map((row) => Number(row.consumo_kg_hembra)), [1384,1428]);
  assert.deepEqual(corregidos.map((row) => Number(row.consumo_kg_macho)), [363,371]);
  assert.deepEqual(corregidos.map((row) => Number(row.suma_saldos_diarios_hembra)), [2912 * 7, 2912 * 7]);
  assert.deepEqual(corregidos.map((row) => Number(row.suma_saldos_diarios_macho)), [467 * 7, 467 * 7]);
  assert.deepEqual(corregidos.map((row) => Number(row.dias_registrados_hembra)), [7, 7]);
  assert.deepEqual(corregidos.map((row) => row.alimentos_hembra),
    [[{alimento:'LPO3',kg:1384}],[{alimento:'LPO3',kg:1428}]]);
  assert.deepEqual(corregidos.map((row) => row.alimentos_macho),
    [[{alimento:'LPO3',kg:363}],[{alimento:'LPO3',kg:371}]]);
  // Valido=N puede ser otro alimento suministrado: NO excluirlo del consumo.
  // Cantidades iguales de distintos dias, galpones o alimentos se suman.
  await db.exec(`
    insert into registro_diario_granja
      ("Fecha","Unid_Prod","Linea_Madre","Cod_Lote","Sexo","Etapa","Edad_sem",
       "Saldo_Final","Tipo_Alim","Cons_Alim","Saldo_Ini","Galpon","Valido") values
      ('2026-06-15','LUMBRA','CRIOLLO','DETALLE','HEMBRA','LEVANTE','4','100','A','50','100','G1','Y'),
      ('2026-06-15','LUMBRA','CRIOLLO','DETALLE','HEMBRA','LEVANTE','4','100','A','50','100','G2','Y'),
      ('2026-06-16','LUMBRA','CRIOLLO','DETALLE','HEMBRA','LEVANTE','4','100','A','50','100','G1','Y'),
      ('2026-06-16','LUMBRA','CRIOLLO','DETALLE','HEMBRA','LEVANTE','4','0','B','50','0','G1','N'),
      ('2026-06-16','LUMBRA','CRIOLLO','DETALLE','HEMBRA','LEVANTE','4','0','B','25','0','G1','N');
  `);
  const detalle = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote='DETALLE'")).rows[0];
  assert.equal(Number(detalle.consumo_kg_hembra), 225);
  assert.deepEqual(detalle.alimentos_hembra, [{alimento:'A',kg:150},{alimento:'B',kg:75}]);
  assert.equal(Number(detalle.suma_saldos_diarios_hembra), 300, 'suma galpones distintos y excluye saldos de filas N');
  assert.equal(Number(detalle.dias_registrados_hembra), 2);
  assert.equal(buildConsumptionChart([detalle], 'hembra', 'g_ave_dia').data[0].total, 750);

  await db.exec(`
    insert into registro_diario_granja
      ("Fecha","Unid_Prod","Linea_Madre","Cod_Lote","Sexo","Etapa","Edad_sem",
       "Saldo_Final","Tipo_Alim","Cons_Alim","Saldo_Ini","Galpon","Valido") values
      ('2026-06-15','LUMBRA','CRIOLLO','PARCIAL','HEMBRA','LEVANTE','4','100','A','6','100','G1','Y'),
      ('2026-06-15','LUMBRA','CRIOLLO','PARCIAL','HEMBRA','LEVANTE','4','100','B','4','100','G1','Y'),
      ('2026-06-16','LUMBRA','CRIOLLO','PARCIAL','HEMBRA','LEVANTE','4','80','A','8','80','G1','Y'),
      ('2026-06-16','LUMBRA','CRIOLLO','PARCIAL','MACHO','LEVANTE','4','20','C','1','20','G1','Y'),
      ('2026-06-15','LUMBRA','CRIOLLO','SIN_SALDO','HEMBRA','LEVANTE','4','100','A','10','100','G1','Y'),
      ('2026-06-16','LUMBRA','CRIOLLO','SIN_SALDO','HEMBRA','LEVANTE','4','100','A','10',null,'G1','Y'),
      ('2026-06-15','LUMBRA','CRIOLLO','SOLO_N','HEMBRA','LEVANTE','4','0','A','10','0','G1','N'),
      ('2026-06-15','LUMBRA','CRIOLLO','NEGATIVO','HEMBRA','LEVANTE','4','100','A','10','-100','G1','Y'),
      ('2026-06-15','LUMBRA','CRIOLLO','CERO','HEMBRA','LEVANTE','4','0','A','0','0','G1','Y');
  `);
  const partial = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote='PARCIAL'")).rows[0];
  assert.equal(Number(partial.suma_saldos_diarios_hembra), 180, 'dos alimentos del día 1 no duplican sus 100 aves');
  assert.equal(Number(partial.suma_saldos_diarios_macho), 20);
  assert.equal(Number(partial.dias_registrados_hembra), 2);
  assert.equal(Number(partial.dias_registrados_macho), 1);
  const dailyFemale = buildConsumptionChart([partial], 'hembra', 'g_ave_dia').data[0];
  assert.equal(dailyFemale.total, 100);
  assert.ok(Math.abs(dailyFemale.alimento_0 + dailyFemale.alimento_1 - 100) < 1e-10);
  assert.equal(buildConsumptionChart([partial], 'macho', 'g_ave_dia').data[0].total, 50);
  const absent = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote in ('SIN_SALDO','SOLO_N','NEGATIVO','CERO')")).rows;
  for (const row of absent) {
    if (row.lote === 'CERO') assert.equal(Number(row.suma_saldos_diarios_hembra), 0);
    else assert.equal(row.suma_saldos_diarios_hembra, null);
    assert.equal(buildConsumptionChart([row], 'hembra', 'g_ave_dia').data[0].total, null);
  }

  // Datos observados de 26PC21 macho, semana 38/2026: dos poblaciones
  // simultaneas (Levante y Postura) bajo el mismo nombre de galpon.
  await db.exec(`
    insert into calendario select fecha::date, 2026, 38
      from generate_series('2026-09-20'::date, '2026-09-26'::date, '1 day') fecha;
    insert into registro_diario_granja
      ("Fecha","Unid_Prod","Linea_Madre","Cod_Lote","Sexo","Etapa","Edad_sem",
       "Saldo_Final","Tipo_Alim","Cons_Alim","Saldo_Ini","Galpon","Valido")
      select fecha::date, 'LUMBRA', 'CRIOLLO', '26PC21', 'MACHO', etapa,
        case when fecha < '2026-09-25' then '30' else '31' end,
        saldo::text, alimento, kg, saldo::text, 'S.E.', 'Y'
      from (values
        ('2026-09-20',211),('2026-09-21',210),('2026-09-22',210),
        ('2026-09-23',209),('2026-09-24',208),('2026-09-25',208),('2026-09-26',208)
      ) as dias(fecha, saldo_postura)
      cross join lateral (values
        ('LEVANTE - POLLO',296,'LPO3','40'),
        ('POSTURA - POLLO',saldo_postura,'PPOMA','25')
      ) as etapas(etapa,saldo,alimento,kg);
    insert into "Resumen Lotes Cod STD" values ('26PC21','CASO26PC21');
    insert into estandares_pollos values ('CASO26PC21',31,'MACHO','PPOMA','140');
  `);
  const case26 = (await db.query("select * from lumbra.vista_consumo_por_lote_semanal where lote='26PC21' and ano=2026 and semana=38")).rows[0];
  assert.equal(Number(case26.consumo_kg_macho), 455);
  assert.equal(Number(case26.suma_saldos_diarios_macho), 3536, '2072 de Levante más 1464 de Postura');
  assert.equal(Number(case26.dias_registrados_macho), 7, 'dos etapas no duplican los días');
  assert.deepEqual(case26.alimentos_macho, [{ alimento: 'LPO3', kg: 280 }, { alimento: 'PPOMA', kg: 175 }]);
  const chart26 = buildConsumptionChart([case26], 'macho', 'g_ave_dia').data[0];
  assert.ok(Math.abs(chart26.total - 455000 / 3536) < 1e-10);
  assert.equal(chart26.standardTotal, 140);
  assert.ok(Math.abs(chart26.alimento_0 + chart26.alimento_1 - chart26.total) < 1e-10);
  const columns = 'ano,semana,fecha,linea,lote,saldo_final_hembras,saldo_final_machos,total_aves,edad_lote';
  const original = await db.query(`select ${columns} from lumbra.vista_poblacion_por_lote_y_semana order by ano,semana,linea,lote`);
  const added = await db.query(`select ${columns} from lumbra.vista_consumo_por_lote_semanal order by ano,semana,linea,lote`);
  assert.deepEqual(added.rows, original.rows, 'preserva exactamente las nueve columnas y filas de poblacion');
  const plan = await db.query('explain (analyze, format json) select * from lumbra.vista_consumo_por_lote_semanal where ano=2026 and semana=25');
  assert.ok(plan.rows.length);
  console.log('PASS SQL: población conservada; saldo inicial promedio de la primera fecha por sexo; alimentos separados; kg diarios sumados; estándar g/ave/día convertido a kg semanales; edad semanal; etapas; años/semanas; duplicados; conflictos; nulos; negativos; instalación repetible y consulta ejecutada.');
  console.log('PASS SQL + gráfico: suma diaria por galpón, semanas parciales, población variable, alimentos repetidos, Valido=N, bases inválidas y separación por sexo.');
  console.log('PASS 26PC21: machos de Levante y Postura suman 3536 aves-día; 455 kg producen 128.68 g/ave/día.');
} finally { await db.close(); }
