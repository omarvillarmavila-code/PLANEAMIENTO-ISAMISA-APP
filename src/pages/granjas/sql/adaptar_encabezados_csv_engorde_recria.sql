-- Adapta la tabla existente a los 74 encabezados EXACTOS del CSV del usuario.
-- Conservar los espacios finales de los nombres entre comillas.
-- No elimina datos. Puede repetirse si los nombres ya fueron corregidos.
begin;
do $migration$
declare
  item record;
  old_exists boolean;
  new_exists boolean;
begin
  if to_regclass('public.registro_diario_engorde_recria') is null then
    raise exception 'No existe public.registro_diario_engorde_recria';
  end if;
  for item in select * from (values
    ('Periodo', 'Periodo '),
    ('Fecha', 'Fecha '),
    ('Cod_Lote', 'Cod Lote'),
    ('Especie', 'Especie '),
    ('Linea_Padre', 'Línea Padre'),
    ('Linea_Madre', 'Línea Madre'),
    ('Variedad', 'Variedad '),
    ('Muda', 'Muda '),
    ('Sexo', 'Sexo '),
    ('Unid_Prod', 'Unid Prod'),
    ('Galpon', 'Galpon '),
    ('Fecha_Ing', 'Fecha Ing'),
    ('Edad_ingreso', 'Edad ingreso'),
    ('Aves_Ing', 'Aves Ing (unid)'),
    ('Mortal_Transporte', 'N° Mortal Tr ansp. (unid)'),
    ('Fecha_Cmb_Etap', 'Fecha Cmb. Etap'),
    ('Aves_Cmb_Etap', 'Aves Cmb. Etap(unid)'),
    ('Etapa', 'Etapa '),
    ('Etapa_Co', 'Etapa Co '),
    ('Edad_dias', 'Edad (días)'),
    ('Edad_sem', 'Edad (sem)'),
    ('Semana_Calendario', 'Semana Calendario'),
    ('Peso_Ave', 'Peso Ave (g)'),
    ('Mortal', 'Mortal (unid)'),
    ('Mortal_Acum', 'Mortal Acum(unid)'),
    ('Mortal_Porc_Transf', 'Mortal. (%) Transf'),
    ('Mortal_Porc_Transf_Acum', 'Mortal. (%) Transf Acum'),
    ('Desc_unid', 'Desc (unid)'),
    ('Desc_Kg', 'Desc (Kg)'),
    ('Desc_Acum', 'Desc Ac um(unid)'),
    ('Descarte_Porc_Transf', 'Descarte (%) Transf'),
    ('Descarte_Porc_Transf_Acum', 'Descarte (%) Transf Acum'),
    ('Venta_unid', 'Venta (unid)'),
    ('Venta_Acum', 'Venta Ac um(unid)'),
    ('Transf_Ing', 'Transf Ing.(unid)'),
    ('Transf_Acum_Ing', 'Transf. Acum Ing.(unid)'),
    ('Transf_Sal', 'Transf. Sal(unid)'),
    ('Transf_Acum_Sal', 'Transf Acum Sal(unid)'),
    ('Origen', 'Origen '),
    ('Destino', 'Destino '),
    ('Uniform', 'Uniform (%)'),
    ('Cons_Alim', 'Cons Alim(Kg)'),
    ('Tipo_Alim', 'Tipo Alim'),
    ('Cons_Alim_Ave', 'Cons Alim Ave (g/ave/d)'),
    ('Cons_Alim_Ave_Acu', 'Cons Alim Ave Acu (g/ave)'),
    ('Prod_Huevo', 'Prod Hue vo(unid)'),
    ('Porc_Prod_Huevo', '% Prod Huevo'),
    ('Prod_HInc', 'Prod HInc (unid)'),
    ('Prod_HMer', 'Prod HMer (und)'),
    ('Prod_HInc_Porc', 'Prod HInc (%)'),
    ('Prod_HCom', 'Prod HCom (unid)'),
    ('Huevos_Inc_Kg', 'Huevos Inc.(Kg)'),
    ('Persistencia', 'Persisten cia (sem)'),
    ('HI_x_Gallina', 'HI x Gallina Encaset(unid)'),
    ('Peso_Ventas', 'Peso Ven tas (Kg)'),
    ('Peso_Beneficio', 'Peso Ben eficio (Kg)'),
    ('Guia_Despacho_Aves', 'Guía de Despacho Aves'),
    ('Guia_Despacho_Huevos', 'Guía de Despacho Huevos'),
    ('Saldo_Ini', 'Saldo Ini (unid)'),
    ('Saldo_Final', 'Saldo Final (unid)'),
    ('Fecha_Liquidacion', 'Fecha Liquidacion'),
    ('Estado_Lote', 'Estado Lote'),
    ('Edad_Sem_Prd', 'Edad Sem Prd'),
    ('Consumo_Estandar', 'Consumo Estandar'),
    ('Consumo_Acu_Estandar', 'Consumo Acu Estandar'),
    ('Peso_Estandar', 'Peso Estandar'),
    ('Postur_Estandar', '% Postur Estandar'),
    ('HI_Estandar', '% HI Estandar'),
    ('HT_x_Gallina', 'HT x Gallina Encaset (und)'),
    ('Costo_Alimento', 'Costo Alimento'),
    ('Costo_Alimento_Ave_Diario', 'Costo Alimento Por Ave Diario'),
    ('Costo_Alimento_Ave_Acum', 'Costo Alimento Por Ave Acum.'),
    ('Valido', 'Val ido'),
    ('Codigo_Registro', 'Còdigo de Registro')
  ) as names(old_name, new_name)
  loop
    select exists(select 1 from pg_attribute where attrelid = 'public.registro_diario_engorde_recria'::regclass and attname = item.old_name and not attisdropped),
           exists(select 1 from pg_attribute where attrelid = 'public.registro_diario_engorde_recria'::regclass and attname = item.new_name and not attisdropped)
      into old_exists, new_exists;
    if old_exists and not new_exists then
      execute format('alter table public.registro_diario_engorde_recria rename column %I to %I', item.old_name, item.new_name);
    elsif old_exists and new_exists and item.old_name <> item.new_name then
      raise exception 'Hay dos columnas para el mismo campo: % y %', item.old_name, item.new_name;
    elsif not new_exists then
      raise exception 'Falta la columna % (o %)', item.old_name, item.new_name;
    end if;
  end loop;
end;
$migration$;
notify pgrst, 'reload schema';
commit;

-- Verificacion: los espacios finales forman parte de los encabezados.
select ordinal_position, quote_ident(column_name) as encabezado_exacto
from information_schema.columns
where table_schema = 'public' and table_name = 'registro_diario_engorde_recria'
order by ordinal_position;
