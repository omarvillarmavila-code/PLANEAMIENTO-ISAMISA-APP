-- Vista fija de poblacion por lote y semana para Lumbra.
drop view if exists lumbra.vista_aves_por_lote_y_semana;
create or replace view lumbra.vista_poblacion_por_lote_y_semana as
with r as (
 select c.ano,c.semana,d."Fecha"::date fecha,coalesce(nullif(trim(d."Linea_Madre"::text),''),'SIN LINEA') linea,coalesce(nullif(trim(d."Cod_Lote"::text),''),'SIN LOTE') lote,upper(trim(coalesce(d."Sexo",''))) sexo,avg(coalesce(nullif(regexp_replace(coalesce(d."Saldo_Final",'0')::text,'[^0-9.-]','','g'),''),'0')::numeric) saldo,max(d."Edad_sem"::text) edad
 from public.registro_diario_granja d left join public.calendario c on c.fecha=d."Fecha"::date
 where upper(trim(coalesce(d."Unid_Prod",'')))='LUMBRA' and upper(trim(coalesce(d."Sexo",''))) in('HEMBRA','MACHO') and c.ano is not null and c.semana is not null
 group by c.ano,c.semana,d."Fecha"::date,d."Linea_Madre",d."Cod_Lote",d."Sexo"
), f as (select *,max(fecha) over(partition by ano,semana,linea,lote) fecha_actual from r)
select ano,semana,fecha_actual fecha,linea,lote,coalesce(sum(saldo) filter(where sexo='HEMBRA'),0) saldo_final_hembras,coalesce(sum(saldo) filter(where sexo='MACHO'),0) saldo_final_machos,coalesce(sum(saldo),0) total_aves,max(edad) edad_lote
from f where fecha=fecha_actual group by ano,semana,fecha_actual,linea,lote;
grant select on lumbra.vista_poblacion_por_lote_y_semana to anon,authenticated;
notify pgrst,'reload schema';
