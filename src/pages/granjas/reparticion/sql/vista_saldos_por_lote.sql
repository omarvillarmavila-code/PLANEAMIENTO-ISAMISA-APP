-- Resumen para el filtro de Saldos por lote.
create
or replace view public.resumen_especie_linea_lote_reparticion as
select
  "Especie" :: text as especie,
  "Linea_Madre" :: text as linea,
  "Cod_Lote" :: text as cod_lote,
  max("Fecha") :: date as fecha_mas_reciente
from
  public.registro_diario_granja
where
  upper(trim(coalesce("Unid_Prod", ''))) = 'REPARTICIÓN'
  and upper(trim(coalesce("Sexo", ''))) = 'HEMBRA'
  and upper(trim(coalesce("Valido", ''))) = 'Y'
group by
  "Especie",
  "Linea_Madre",
  "Cod_Lote";

-- Detalle del lote elegido desde la aplicación.
create
or replace function public.detalle_lote_reparticion(lote_filtro text) returns table(
  fecha date,
  cod_lote text,
  sexo text,
  etapa text,
  edad_sem text,
  mortal text,
  desc_unid text,
  venta_unid text,
  transf_ing text,
  transf_sal text,
  origen text,
  destino text,
  saldo_ini text,
  saldo_final text,
  valido text
) language sql stable security definer
set
  search_path = public as $$
select
  "Fecha" :: date,
  "Cod_Lote" :: text,
  "Sexo" :: text,
  "Etapa" :: text,
  "Edad_sem" :: text,
  "Mortal" :: text,
  "Desc_unid" :: text,
  "Venta_unid" :: text,
  "Transf_Ing" :: text,
  "Transf_Sal" :: text,
  "Origen" :: text,
  "Destino" :: text,
  "Saldo_Ini" :: text,
  "Saldo_Final" :: text,
  "Valido" :: text
from
  public.registro_diario_granja
where
  upper(trim(coalesce("Unid_Prod", ''))) = 'REPARTICIÓN'
  and upper(trim(coalesce("Sexo", ''))) = 'HEMBRA'
  and upper(trim(coalesce("Valido", ''))) = 'Y'
  and "Cod_Lote" :: text = lote_filtro
order by
  "Fecha" desc;

$$;

grant
select
  on public.resumen_especie_linea_lote_reparticion to authenticated;

grant execute on function public.detalle_lote_reparticion(text) to authenticated;

-- Vista única de saldos para ambos sexos.
drop view if exists public.vista_saldos_aves_reparticion;

create
or replace view public.vista_saldos_por_lote_reparticion as
select
  "Fecha" :: date as fecha,
  "Cod_Lote" :: text as cod_lote,
  "Sexo" :: text as sexo,
  max("Etapa") :: text as etapa,
  max("Edad_sem") :: text as edad_sem,
  avg(
    nullif(
      regexp_replace(
        coalesce("Mortal", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as mortal,
  avg(
    nullif(
      regexp_replace(
        coalesce("Desc_unid", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as desc_unid,
  avg(
    nullif(
      regexp_replace(
        coalesce("Venta_unid", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as venta_unid,
  avg(
    nullif(
      regexp_replace(
        coalesce("Transf_Ing", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as transf_ing,
  avg(
    nullif(
      regexp_replace(
        coalesce("Transf_Sal", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as transf_sal,
  avg(
    nullif(
      regexp_replace(
        coalesce("Saldo_Ini", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as saldo_ini,
  avg(
    nullif(
      regexp_replace(
        coalesce("Saldo_Final", '0') :: text,
        '[^0-9.-]',
        '',
        'g'
      ),
      ''
    ) :: numeric
  ) :: text as saldo_final,
  max("Valido") :: text as valido
from
  public.registro_diario_granja
where
  upper(trim(coalesce("Unid_Prod", ''))) = 'REPARTICIÓN'
  and upper(trim(coalesce("Sexo", ''))) in ('HEMBRA', 'MACHO')
  and upper(trim(coalesce("Valido", ''))) = 'Y'
group by
  "Fecha" :: date,
  "Cod_Lote" :: text,
  "Sexo" :: text;

grant
select
  on public.vista_saldos_por_lote_reparticion to authenticated;
