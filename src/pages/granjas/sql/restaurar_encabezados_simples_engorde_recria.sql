-- Restaurar encabezados simples para importar el CSV normalizado.
-- Ejecutar cuando se disponga del CSV con los encabezados normalizados.
-- Conserva datos, tipos, id, created_at, indices y politicas.
begin;
do $migration$
declare item record; source_exists boolean; target_exists boolean;
begin
  for item in select * from (values
    ('Periodo ', 'Periodo'),
    ('Fecha ', 'Fecha'),
    ('Cod Lote', 'Cod_Lote'),
    ('Especie ', 'Especie'),
    ('Línea Padre', 'Linea_Padre'),
    ('Línea Madre', 'Linea_Madre'),
    ('Variedad ', 'Variedad'),
    ('Muda ', 'Muda'),
    ('Sexo ', 'Sexo'),
    ('Unid Prod', 'Unid_Prod'),
    ('Galpon ', 'Galpon'),
    ('Fecha Ing', 'Fecha_Ing'),
    ('Edad ingreso', 'Edad_ingreso'),
    ('Aves Ing (unid)', 'Aves_Ing'),
    ('N° Mortal Tr ansp. (unid)', 'Mortal_Transporte'),
    ('Fecha Cmb. Etap', 'Fecha_Cmb_Etap'),
    ('Aves Cmb. Etap(unid)', 'Aves_Cmb_Etap'),
    ('Etapa ', 'Etapa'),
    ('Etapa Co ', 'Etapa_Co'),
    ('Edad (días)', 'Edad_dias'),
    ('Edad (sem)', 'Edad_sem'),
    ('Semana Calendario', 'Semana_Calendario'),
    ('Peso Ave (g)', 'Peso_Ave'),
    ('Mortal (unid)', 'Mortal'),
    ('Mortal Acum(unid)', 'Mortal_Acum'),
    ('Mortal. (%) Transf', 'Mortal_Porc_Transf'),
    ('Mortal. (%) Transf Acum', 'Mortal_Porc_Transf_Acum'),
    ('Desc (unid)', 'Desc_unid'),
    ('Desc (Kg)', 'Desc_Kg'),
    ('Desc Ac um(unid)', 'Desc_Acum'),
    ('Descarte (%) Transf', 'Descarte_Porc_Transf'),
    ('Descarte (%) Transf Acum', 'Descarte_Porc_Transf_Acum'),
    ('Venta (unid)', 'Venta_unid'),
    ('Venta Ac um(unid)', 'Venta_Acum'),
    ('Transf Ing.(unid)', 'Transf_Ing'),
    ('Transf. Acum Ing.(unid)', 'Transf_Acum_Ing'),
    ('Transf. Sal(unid)', 'Transf_Sal'),
    ('Transf Acum Sal(unid)', 'Transf_Acum_Sal'),
    ('Origen ', 'Origen'),
    ('Destino ', 'Destino'),
    ('Uniform (%)', 'Uniform'),
    ('Cons Alim(Kg)', 'Cons_Alim'),
    ('Tipo Alim', 'Tipo_Alim'),
    ('Cons Alim Ave (g/ave/d)', 'Cons_Alim_Ave'),
    ('Cons Alim Ave Acu (g/ave)', 'Cons_Alim_Ave_Acu'),
    ('Prod Hue vo(unid)', 'Prod_Huevo'),
    ('% Prod Huevo', 'Porc_Prod_Huevo'),
    ('Prod HInc (unid)', 'Prod_HInc'),
    ('Prod HMer (und)', 'Prod_HMer'),
    ('Prod HInc (%)', 'Prod_HInc_Porc'),
    ('Prod HCom (unid)', 'Prod_HCom'),
    ('Huevos Inc.(Kg)', 'Huevos_Inc_Kg'),
    ('Persisten cia (sem)', 'Persistencia'),
    ('HI x Gallina Encaset(unid)', 'HI_x_Gallina'),
    ('Peso Ven tas (Kg)', 'Peso_Ventas'),
    ('Peso Ben eficio (Kg)', 'Peso_Beneficio'),
    ('Guía de Despacho Aves', 'Guia_Despacho_Aves'),
    ('Guía de Despacho Huevos', 'Guia_Despacho_Huevos'),
    ('Saldo Ini (unid)', 'Saldo_Ini'),
    ('Saldo Final (unid)', 'Saldo_Final'),
    ('Fecha Liquidacion', 'Fecha_Liquidacion'),
    ('Estado Lote', 'Estado_Lote'),
    ('Edad Sem Prd', 'Edad_Sem_Prd'),
    ('Consumo Estandar', 'Consumo_Estandar'),
    ('Consumo Acu Estandar', 'Consumo_Acu_Estandar'),
    ('Peso Estandar', 'Peso_Estandar'),
    ('% Postur Estandar', 'Postur_Estandar'),
    ('% HI Estandar', 'HI_Estandar'),
    ('HT x Gallina Encaset (und)', 'HT_x_Gallina'),
    ('Costo Alimento', 'Costo_Alimento'),
    ('Costo Alimento Por Ave Diario', 'Costo_Alimento_Ave_Diario'),
    ('Costo Alimento Por Ave Acum.', 'Costo_Alimento_Ave_Acum'),
    ('Val ido', 'Valido'),
    ('Còdigo de Registro', 'Codigo_Registro')
  ) as names(source_name, target_name)
  loop
    select exists(select 1 from pg_attribute where attrelid='public.registro_diario_engorde_recria'::regclass and attname=item.source_name and not attisdropped),
           exists(select 1 from pg_attribute where attrelid='public.registro_diario_engorde_recria'::regclass and attname=item.target_name and not attisdropped)
    into source_exists, target_exists;
    if source_exists and not target_exists then
      execute format('alter table public.registro_diario_engorde_recria rename column %I to %I', item.source_name, item.target_name);
    elsif source_exists and target_exists and item.source_name <> item.target_name then
      raise exception 'Existen dos columnas para el campo %', item.target_name;
    elsif not target_exists then
      raise exception 'No existe el campo %', item.target_name;
    end if;
  end loop;
end;
$migration$;
notify pgrst, 'reload schema';
commit;
