-- Promedio de saldo por fecha, linea, lote y sexo para la fecha mas reciente.
create
or replace view public.aves_por_lote_reparticion as
select
    "Fecha" :: date as fecha,
    "Linea_Madre" :: text as linea,
    "Cod_Lote" :: text as lote,
    "Sexo" :: text as sexo,
    avg(
        coalesce(
            nullif(
                regexp_replace(
                    coalesce("Saldo_Final", '0') :: text,
                    '[^0-9.-]',
                    '',
                    'g'
                ),
                ''
            ),
            '0'
        ) :: numeric
    ) :: numeric as saldo_final,
    "Edad_sem" :: text as edad_lote
from
    public.registro_diario_granja
where
    upper(trim(coalesce("Unid_Prod", ''))) = 'REPARTICIÓN'
    and "Fecha" =(
        select
            max("Fecha")
        from
            public.registro_diario_granja
        where
            upper(trim(coalesce("Unid_Prod", ''))) = 'REPARTICIÓN'
    )
group by
    fecha,
    linea,
    lote,
    sexo,
    edad_lote
order by
    case
        upper(trim("Linea_Madre"))
        when 'CRIOLLO' then 1
        when 'ISAMISA' then 2
        when 'FRANCES' then 3
        when 'BARRADO' then 4
        when 'DEKALB' then 5
        else 99
    end,
    "Cod_Lote",
    "Sexo";

grant
select
    on public.aves_por_lote_reparticion to authenticated;
