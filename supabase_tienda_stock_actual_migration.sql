-- Vista de stock agregado por producto/ubicación.
--
-- Motivo: el frontend calculaba stock descargando TODAS las filas de
-- producto_inventario y producto_ventas sin paginación. PostgREST limita
-- cada respuesta a 1000 filas, así que al superar las 1000 ventas
-- (≈2026-07-05) las ventas nuevas dejaron de restarse del stock mostrado.
-- Esta vista hace la suma en la base: la respuesta es una fila por
-- combinación producto/ubicación, inmune al límite.
--
-- APLICAR ANTES de desplegar el frontend que consulta stock_actual
-- (orden SQL-primero; el frontend viejo no se ve afectado por la vista).

create or replace view public.stock_actual
with (security_invoker = true) as
select
  coalesce(i.producto_id, v.producto_id) as producto_id,
  coalesce(i.ubicacion_id, v.ubicacion_id) as ubicacion_id,
  coalesce(i.ingresado, 0) - coalesce(v.vendido, 0) as stock,
  coalesce(i.precio_venta, 0) as precio_venta,
  coalesce(i.costo_unitario, 0) as costo_unitario
from (
  select
    producto_id,
    ubicacion_id,
    sum(cantidad) as ingresado,
    -- mismo criterio que usaba el dashboard: precio/costo de la fila
    -- de inventario más reciente de la combinación
    (array_agg(precio_venta order by created_at desc, id desc))[1] as precio_venta,
    (array_agg(costo_unitario order by created_at desc, id desc))[1] as costo_unitario
  from public.producto_inventario
  group by producto_id, ubicacion_id
) i
full outer join (
  select producto_id, ubicacion_id, sum(cantidad) as vendido
  from public.producto_ventas
  group by producto_id, ubicacion_id
) v
  on i.producto_id = v.producto_id
 and i.ubicacion_id = v.ubicacion_id;

-- security_invoker: la vista corre con los permisos del usuario que consulta,
-- así que las políticas RLS de las tablas base siguen aplicando.
grant select on public.stock_actual to authenticated;
