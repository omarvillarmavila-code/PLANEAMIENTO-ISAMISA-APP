-- Ejecutar una vez en el SQL Editor de Supabase como propietario de la base.
-- No modifica permisos ni politicas de registro_diario_granja.
-- Mantener csv_granja_interno fuera de los schemas expuestos por la Data API.
begin;

create schema if not exists csv_granja_interno;
revoke all on schema csv_granja_interno from public, anon;
grant usage on schema csv_granja_interno to authenticated;

create table if not exists csv_granja_interno.cargas (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null default auth.uid(),
  huella text not null check (huella ~ '^[a-f0-9]{64}$'),
  archivo text not null check (length(archivo) between 1 and 255),
  total integer not null check (total between 1 and 100000),
  columnas text[] not null,
  firma_esquema text not null,
  estado text not null default 'preparando' check (estado in ('preparando', 'completada')),
  importadas integer not null default 0,
  creada timestamptz not null default now(),
  completada timestamptz,
  unique (usuario, huella)
);
create table if not exists csv_granja_interno.bloques (
  carga uuid not null references csv_granja_interno.cargas(id),
  indice integer not null check (indice >= 0),
  filas jsonb not null check (jsonb_typeof(filas) = 'array' and jsonb_array_length(filas) between 1 and 250),
  primary key (carga, indice)
);
alter table csv_granja_interno.cargas enable row level security;
alter table csv_granja_interno.bloques enable row level security;
revoke all on csv_granja_interno.cargas, csv_granja_interno.bloques from public, anon, authenticated;
grant select, insert, update on csv_granja_interno.cargas to authenticated;
grant select, insert, delete on csv_granja_interno.bloques to authenticated;
drop policy if exists csv_cargas_propias on csv_granja_interno.cargas;
create policy csv_cargas_propias on csv_granja_interno.cargas to authenticated
  using (usuario = (select auth.uid())) with check (usuario = (select auth.uid()));
drop policy if exists csv_bloques_propios on csv_granja_interno.bloques;
create policy csv_bloques_propios on csv_granja_interno.bloques to authenticated
  using (exists (select 1 from csv_granja_interno.cargas c where c.id = carga and c.usuario = (select auth.uid())))
  with check (exists (select 1 from csv_granja_interno.cargas c where c.id = carga and c.usuario = (select auth.uid()) and c.estado = 'preparando'));

create or replace function public.granja_csv_esquema()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_columnas jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.' using errcode = '42501'; end if;
  select jsonb_agg(jsonb_build_object(
    'name', c.column_name, 'type', c.udt_name,
    'nullable', c.is_nullable = 'YES', 'defaultValue', c.column_default,
    'automatic', c.is_identity = 'YES' or c.is_generated <> 'NEVER'
      or (c.column_default is not null and c.column_default like 'nextval(%'),
    'maxLength', c.character_maximum_length, 'precision', c.numeric_precision,
    'scale', c.numeric_scale,
    'enumValues', (select jsonb_agg(e.enumlabel order by e.enumsortorder)
      from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid = e.enumtypid
      join pg_catalog.pg_namespace n on n.oid = t.typnamespace
      where t.typname = c.udt_name and n.nspname = c.udt_schema)
  ) order by c.ordinal_position) into v_columnas
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'registro_diario_granja';
  if v_columnas is null then raise exception 'No se puede consultar la estructura de registros de granja.'; end if;
  return jsonb_build_object('columns', v_columnas, 'signature', md5(v_columnas::text),
    'canInsert', has_table_privilege(current_user, 'public.registro_diario_granja', 'INSERT'));
end;
$$;

create or replace function public.granja_csv_iniciar(
  p_huella text, p_archivo text, p_total integer, p_columnas text[], p_firma text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_esquema jsonb; v_carga csv_granja_interno.cargas; v_col jsonb;
begin
  v_esquema := public.granja_csv_esquema();
  if not (v_esquema->>'canInsert')::boolean then
    raise exception 'Tu cuenta no tiene permiso para importar registros.' using errcode = '42501';
  end if;
  if p_firma is distinct from v_esquema->>'signature' then
    raise exception 'La estructura de la tabla cambio. Vuelve a validar el archivo.';
  end if;
  if p_total is null or p_total not between 1 and 100000
    or p_huella is null or p_huella !~ '^[a-f0-9]{64}$'
    or p_archivo is null or length(p_archivo) not between 1 and 255
    or coalesce(cardinality(p_columnas), 0) = 0 then
    raise exception 'Datos de carga invalidos.';
  end if;
  if exists (select 1 from unnest(p_columnas) n group by n having count(*) > 1)
    or exists (select 1 from unnest(p_columnas) n where n is null or not exists (
      select 1 from jsonb_array_elements(v_esquema->'columns') c
      where c->>'name' = n and not (c->>'automatic')::boolean)) then
    raise exception 'La carga contiene columnas desconocidas, automaticas o repetidas.';
  end if;
  if not (array['Fecha','Unid_Prod','Cod_Lote','Sexo','Etapa']::text[] <@ p_columnas) then
    raise exception 'Faltan Fecha, Unid_Prod, Cod_Lote, Sexo o Etapa.';
  end if;
  for v_col in select value from jsonb_array_elements(v_esquema->'columns') loop
    if not (v_col->>'nullable')::boolean and not (v_col->>'automatic')::boolean
      and v_col->>'defaultValue' is null and not (v_col->>'name' = any(p_columnas)) then
      raise exception 'Falta la columna obligatoria %.', v_col->>'name';
    end if;
  end loop;
  insert into csv_granja_interno.cargas (huella, archivo, total, columnas, firma_esquema)
    values (p_huella, p_archivo, p_total, p_columnas, p_firma)
    on conflict (usuario, huella) do nothing;
  select * into strict v_carga from csv_granja_interno.cargas
    where usuario = auth.uid() and huella = p_huella for update;
  if v_carga.total <> p_total or v_carga.columnas <> p_columnas then
    raise exception 'La carga existente no coincide con el archivo validado.';
  end if;
  if v_carga.estado = 'preparando' and v_carga.firma_esquema <> p_firma then
    -- Los bloques pendientes se validaran otra vez contra la estructura nueva.
    delete from csv_granja_interno.bloques where carga = v_carga.id;
    update csv_granja_interno.cargas set firma_esquema = p_firma where id = v_carga.id;
  end if;
  return jsonb_build_object('id', v_carga.id, 'estado', v_carga.estado,
    'importadas', v_carga.importadas,
    'bloques', coalesce((select jsonb_agg(indice order by indice)
      from csv_granja_interno.bloques where carga = v_carga.id), '[]'::jsonb));
end;
$$;

create or replace function public.granja_csv_guardar_bloque(p_carga uuid, p_indice integer, p_filas jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_carga csv_granja_interno.cargas; v_existente jsonb; v_row jsonb;
  v_col text; v_i integer := 0; v_requeridas text[]; v_descartado jsonb;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.' using errcode = '42501'; end if;
  select * into v_carga from csv_granja_interno.cargas
    where id = p_carga and usuario = auth.uid() for update;
  if not found then raise exception 'Carga no encontrada.'; end if;
  if v_carga.estado <> 'preparando' then raise exception 'Esta carga ya fue completada.'; end if;
  if p_indice is null or p_indice < 0 or p_indice >= (v_carga.total + 249) / 250
    or p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Bloque invalido.';
  end if;
  if jsonb_array_length(p_filas) <> least(250, v_carga.total - p_indice * 250) then
    raise exception 'El bloque no contiene la cantidad esperada de filas.';
  end if;
  if v_carga.firma_esquema <> public.granja_csv_esquema()->>'signature' then
    raise exception 'La estructura cambio. Vuelve a validar el archivo.';
  end if;
  select filas into v_existente from csv_granja_interno.bloques where carga = p_carga and indice = p_indice;
  if found then
    if v_existente <> p_filas then raise exception 'El bloque existente contiene otros datos.'; end if;
    return jsonb_array_length(v_existente);
  end if;
  select coalesce(array_agg(column_name::text), '{}'::text[]) into v_requeridas
    from information_schema.columns where table_schema = 'public'
      and table_name = 'registro_diario_granja' and is_nullable = 'NO'
      and column_name = any(v_carga.columnas);
  for v_row in select value from jsonb_array_elements(p_filas) loop
    v_i := v_i + 1;
    if jsonb_typeof(v_row) <> 'object' then raise exception 'Registro % invalido.', p_indice * 250 + v_i; end if;
    if (select count(*) from jsonb_object_keys(v_row)) <> cardinality(v_carga.columnas)
      or not (v_row ?& v_carga.columnas) then
      raise exception 'Registro %: las columnas no coinciden.', p_indice * 250 + v_i;
    end if;
    foreach v_col in array v_requeridas loop
      if v_row->>v_col is null then
        raise exception 'Registro %, columna %: falta un valor obligatorio.', p_indice * 250 + v_i, v_col;
      end if;
    end loop;
    if coalesce(v_row->>'Fecha','') !~ '^\d{4}-\d{2}-\d{2}$'
      or nullif(btrim(v_row->>'Unid_Prod'),'') is null
      or nullif(btrim(v_row->>'Cod_Lote'),'') is null
      or coalesce(v_row->>'Sexo','') not in ('HEMBRA','MACHO')
      or nullif(btrim(v_row->>'Etapa'),'') is null then
      raise exception 'Registro %: revisa fecha, granja, lote, sexo y etapa.', p_indice * 250 + v_i;
    end if;
    -- La conversion de la fila completa valida los tipos reales en PostgreSQL.
    begin
      foreach v_col in array array['Edad_sem','Saldo_Ini','Saldo_Final','Mortal','Prod_HInc','Prod_HCom','Desc_unid','Venta_unid','Transf_Ing','Transf_Sal'] loop
        if v_row->>v_col is not null then
          if v_row->>v_col !~ '^-?[0-9]+(\.[0-9]+)?$' then
            raise exception 'Columna %: numero invalido.', v_col;
          end if;
        end if;
      end loop;
      select to_jsonb(r) into v_descartado
      from jsonb_populate_record(null::public.registro_diario_granja, v_row) r;
    exception when others then
      raise exception 'Registro %: %', p_indice * 250 + v_i, sqlerrm;
    end;
  end loop;
  insert into csv_granja_interno.bloques values (p_carga, p_indice, p_filas);
  return jsonb_array_length(p_filas);
end;
$$;

create or replace function public.granja_csv_finalizar(p_carga uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_carga csv_granja_interno.cargas; v_total integer; v_bloques integer;
  v_cols text; v_select text; v_insertadas integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesion.' using errcode = '42501'; end if;
  select * into v_carga from csv_granja_interno.cargas
    where id = p_carga and usuario = auth.uid() for update;
  if not found then raise exception 'Carga no encontrada.'; end if;
  if v_carga.estado = 'completada' then
    return jsonb_build_object('estado', 'completada', 'importadas', v_carga.importadas, 'yaCompletada', true);
  end if;
  if v_carga.firma_esquema <> public.granja_csv_esquema()->>'signature' then
    raise exception 'La estructura cambio. Vuelve a validar el archivo.';
  end if;
  select coalesce(sum(jsonb_array_length(filas)), 0), count(*) into v_total, v_bloques
    from csv_granja_interno.bloques where carga = p_carga;
  if v_total <> v_carga.total or v_bloques <> (v_carga.total + 249) / 250 then
    raise exception 'Faltan bloques del archivo. Reanuda la carga antes de finalizar.';
  end if;
  select string_agg(format('%I', n), ',' order by ord),
         string_agg(format('r.%I', n), ',' order by ord)
    into v_cols, v_select from unnest(v_carga.columnas) with ordinality as t(n, ord);
  -- Una transaccion: si falla un registro, se revierte toda la insercion.
  -- SECURITY INVOKER mantiene los permisos, RLS, restricciones y triggers reales.
  execute format('insert into public.registro_diario_granja (%s)
    select %s from csv_granja_interno.bloques b
    cross join lateral jsonb_populate_recordset(null::public.registro_diario_granja, b.filas) r
    where b.carga = $1', v_cols, v_select) using p_carga;
  get diagnostics v_insertadas = row_count;
  if v_insertadas <> v_carga.total then raise exception 'No se insertaron todos los registros. Se revirtio la carga.'; end if;
  update csv_granja_interno.cargas set estado = 'completada', importadas = v_insertadas, completada = now()
    where id = p_carga;
  delete from csv_granja_interno.bloques where carga = p_carga;
  return jsonb_build_object('estado', 'completada', 'importadas', v_insertadas, 'yaCompletada', false);
end;
$$;

create or replace function public.granja_csv_historial()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.creada desc), '[]'::jsonb)
  from (select id, archivo, total, estado, importadas, creada, completada
    from csv_granja_interno.cargas where usuario = auth.uid() order by creada desc limit 10) c;
$$;

revoke all on function public.granja_csv_esquema(),
  public.granja_csv_iniciar(text,text,integer,text[],text),
  public.granja_csv_guardar_bloque(uuid,integer,jsonb),
  public.granja_csv_finalizar(uuid), public.granja_csv_historial() from public, anon;
grant execute on function public.granja_csv_esquema(),
  public.granja_csv_iniciar(text,text,integer,text[],text),
  public.granja_csv_guardar_bloque(uuid,integer,jsonb),
  public.granja_csv_finalizar(uuid), public.granja_csv_historial() to authenticated;
notify pgrst, 'reload schema';
commit;
