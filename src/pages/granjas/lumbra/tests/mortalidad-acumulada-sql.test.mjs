import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.CSV_PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create schema lumbra;
    create table calendario (fecha date primary key, ano integer, semana integer);
    create table registro_diario_granja (
      "Fecha" date, "Unid_Prod" text default 'LUMBRA', "Linea_Madre" text default 'A',
      "Cod_Lote" text, "Sexo" text, "Etapa" text default 'LEVANTE - POLLO', "Edad_sem" text,
      "Saldo_Ini" text, "Saldo_Final" text, "Mortal" text, "Mortal_Acum" text,
      "Prod_HInc" numeric, "Prod_HCom" text, "Galpon" text default 'S.E.', "Valido" text default 'Y'
    );
    create table "Resumen Lotes Cod STD" ("LOTE" text, "COD STD" text);
    create table estandares_pollos (
      codigo_estandar text, edad_sem integer, sexo text, prod_hinc text, prod_hcom text,
      mort_sem text, mort_acum text
    );
    insert into calendario values
      ('2025-12-22',2025,52), ('2025-12-23',2025,52),
      ('2026-01-05',2026,2), ('2026-01-06',2026,2);
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum") values
      ('2025-12-22','L1','HEMBRA','1','1000','10'),
      ('2025-12-23','L1','HEMBRA','1','990','20'),
      ('2025-12-22','L1','MACHO','1','200','2'),
      ('2025-12-23','L1','MACHO','1','198','4'),
      ('2026-01-05','L1','HEMBRA','3','950','50'),
      ('2026-01-06','L1','HEMBRA','3','950','45'),
      ('2026-01-05','L1','MACHO','2','190','10'),
      ('2026-01-06','L1','MACHO','2','190','9'),
      -- Sin edad 1: no usar el primer saldo disponible como sustituto.
      ('2026-01-05','SIN_BASE','HEMBRA','3','900','50'),
      -- Base cero y base ausente tampoco producen un porcentaje.
      ('2025-12-22','BASE_CERO','HEMBRA','1','0','5'),
      ('2025-12-22','BASE_NULA','HEMBRA','1',null,'5'),
      -- Correccion a cero: el cierre debe prevalecer sobre el maximo anterior.
      ('2025-12-22','CERO','HEMBRA','1','100','5'),
      ('2025-12-23','CERO','HEMBRA','1','95','0'),
      -- Acumulado ausente al cierre: no rescatar el dato del dia anterior.
      ('2025-12-22','NULO','HEMBRA','1','100','5'),
      ('2025-12-23','NULO','HEMBRA','1','95',null);
    update registro_diario_granja set "Etapa"='POSTURA - POLLO' where "Cod_Lote"='L1' and "Fecha">='2026-01-01';
    insert into "Resumen Lotes Cod STD" values ('L1','STD');
    insert into estandares_pollos (codigo_estandar,edad_sem,sexo,mort_sem,mort_acum) values
      ('STD',1,'HEMBRA','0.005','0.02'),
      ('STD',1,'MACHO','0.006','0'),
      ('STD',2,'MACHO','0.007','0.035'),
      ('STD',3,'HEMBRA','0.008','0.042'),
      ('STD',3,'MACHO','0.009','0.99');
  `);
  const sql = readFileSync(new URL('../sql/03_vista_postura_por_lote_y_semana.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  const rows = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='L1' order by ano,semana")).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => Number(row.poblacion_edad_1_hembra)), [1000, 1000]);
  assert.deepEqual(rows.map((row) => Number(row.poblacion_edad_1_macho)), [200, 200]);
  assert.deepEqual(rows.map((row) => Number(row.mortalidad_acum_hembra)), [20, 45]);
  assert.deepEqual(rows.map((row) => Number(row.mortalidad_acum_macho)), [4, 9]);
  assert.deepEqual(rows.map((row) => Number(row.porcentaje_mortalidad_acum_hembra)), [2, 4.5]);
  assert.deepEqual(rows.map((row) => Number(row.porcentaje_mortalidad_acum_macho)), [2, 4.5]);
  assert.deepEqual(rows.map((row) => Number(row.porcentaje_mortalidad_std_acum_hembra)), [2, 4.2],
    'mort_acum se convierte de proporcion a porcentaje una sola vez');
  assert.deepEqual(rows.map((row) => Number(row.porcentaje_mortalidad_std_acum_macho)), [0, 3.5],
    'el estandar usa la edad de cierre de cada sexo, no la edad de hembras para machos');
  assert.equal(Number(rows[0].porcentaje_mortalidad_std_sem_hembra), 0.5,
    'el estandar semanal conserva su conversion anterior');
  const others = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote<>'L1'")).rows;
  for (const row of others) {
    assert.equal(row.porcentaje_mortalidad_std_acum_hembra, null);
    assert.equal(row.porcentaje_mortalidad_std_acum_macho, null);
    assert.equal(row.porcentaje_mortalidad_acum_macho, null, 'sexo ausente no es cero');
    if (row.lote === 'CERO') assert.equal(Number(row.porcentaje_mortalidad_acum_hembra), 0);
    else assert.equal(row.porcentaje_mortalidad_acum_hembra, null, row.lote);
  }

  // Dos lineas: sumar poblaciones solo el primer dia y acumulados solo al cierre.
  await db.exec(`
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Linea_Madre","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum") values
      ('2025-12-22','VARIAS','A','HEMBRA','1','100','1'),
      ('2025-12-22','VARIAS','B','HEMBRA','1','200','2'),
      ('2025-12-23','VARIAS','A','HEMBRA','1','99','3'),
      ('2025-12-23','VARIAS','B','HEMBRA','1','198','6');
  `);
  const multi = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='VARIAS'")).rows;
  assert.equal(multi.length, 2);
  for (const row of multi) {
    assert.equal(Number(row.poblacion_edad_1_hembra), 300);
    assert.equal(Number(row.mortalidad_acum_hembra), 9);
    assert.equal(Number(row.porcentaje_mortalidad_acum_hembra), 3);
  }
  await db.exec(`update registro_diario_granja set "Mortal_Acum"=null
    where "Cod_Lote"='VARIAS' and "Linea_Madre"='B' and "Fecha"='2025-12-23'`);
  assert.ok((await db.query("select mortalidad_acum_hembra from lumbra.vista_postura_por_lote_y_semana where lote='VARIAS'")).rows
    .every((row) => row.mortalidad_acum_hembra === null));
  // Caso 24PI17: cuatro copias del mismo acumulado seguidas por una sola.
  // Duplicados de edad 1 tampoco deben multiplicar la poblacion inicial.
  await db.exec(`
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum")
    select fecha::date, 'COPIAS', sexo, edad, saldo, acum from (values
      ('2025-12-22','HEMBRA','1','3044','5'),
      ('2025-12-22','MACHO','1','557','1'),
      ('2025-12-23','HEMBRA','69','2152','390'),
      ('2025-12-23','MACHO','69','118','271')
    ) as datos(fecha,sexo,edad,saldo,acum) cross join generate_series(1,4);
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum") values
      ('2026-01-05','COPIAS','HEMBRA','70','2149','396'),
      ('2026-01-05','COPIAS','MACHO','70','118','271');
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum","Valido") values
      ('2025-12-23','COPIAS','HEMBRA','69','0','390','N'),
      -- Una fila de alimento posterior no reemplaza el cierre con poblacion.
      ('2026-01-06','COPIAS','HEMBRA','70','0','999','N');
  `);
  const copias = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='COPIAS' order by ano,semana")).rows;
  assert.deepEqual(copias.map((row) => Number(row.poblacion_edad_1_hembra)), [3044,3044]);
  assert.deepEqual(copias.map((row) => Number(row.poblacion_edad_1_macho)), [557,557]);
  assert.deepEqual(copias.map((row) => Number(row.mortalidad_acum_hembra)), [390,396]);
  assert.deepEqual(copias.map((row) => Number(row.mortalidad_acum_macho)), [271,271]);
  assert.deepEqual(copias.map((row) => Number(row.porcentaje_mortalidad_acum_hembra)), [12.81,13.01]);
  assert.deepEqual(copias.map((row) => Number(row.porcentaje_mortalidad_acum_macho)), [48.65,48.65]);

  // Dos galpones con las mismas cantidades son dos poblaciones distintas.
  await db.exec(`
    insert into registro_diario_granja
      ("Fecha","Cod_Lote","Sexo","Edad_sem","Saldo_Ini","Mortal_Acum","Galpon") values
      ('2025-12-22','GALPONES','HEMBRA','1','100','1','A'),
      ('2025-12-22','GALPONES','HEMBRA','1','100','1','B'),
      ('2025-12-23','GALPONES','HEMBRA','1','99','2','A'),
      ('2025-12-23','GALPONES','HEMBRA','1','99','2','B');
  `);
  const galpones = (await db.query("select * from lumbra.vista_postura_por_lote_y_semana where lote='GALPONES'")).rows[0];
  assert.equal(Number(galpones.poblacion_edad_1_hembra), 200);
  assert.equal(Number(galpones.mortalidad_acum_hembra), 4);
  assert.equal(Number(galpones.porcentaje_mortalidad_acum_hembra), 2);
  // Escala observada en el estandar ISAMISA IMPORTADO del lote 24PI17.
  await db.exec(`update estandares_pollos set mort_acum='0.179306440810877'
    where codigo_estandar='STD' and edad_sem=3 and sexo='HEMBRA'`);
  const standardReal = (await db.query("select porcentaje_mortalidad_std_acum_hembra from lumbra.vista_postura_por_lote_y_semana where lote='L1' and ano=2026")).rows[0];
  assert.ok(Math.abs(Number(standardReal.porcentaje_mortalidad_std_acum_hembra) - 17.9306440810877) < 1e-10);
  console.log('PASS: cierre semanal, base fija, duplicados, Valido=N, galpones distintos, sexo, etapas, correcciones, nulos y cero.');
} finally { await db.close(); }
