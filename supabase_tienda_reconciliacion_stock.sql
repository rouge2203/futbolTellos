-- Conciliación única de stock tras corregir el bug del límite de 1000 filas.
--
-- Contexto: entre ~2026-07-05 y 2026-08-10 el stock mostrado no restaba las
-- ventas nuevas (filas de producto_ventas con id > 1073, las que quedaban
-- fuera de la ventana de 1000 filas que devolvía PostgREST). El cliente hizo
-- "Correcciones" manuales para cuadrar la pantalla con el conteo físico, es
-- decir, esas correcciones ya descontaron unidades que ahora la fórmula
-- corregida vuelve a restar como ventas → doble descuento.
--
-- Supuesto: cada corrección (nota 'Correc...') fue un conteo físico completo
-- de ese producto en esa ubicación. Entonces las unidades descontadas dos
-- veces son exactamente las ventas invisibles (id > 1073) ANTERIORES a la
-- última corrección de cada combinación. Este script las devuelve con un
-- ajuste positivo por combinación.
--
-- EJECUTAR UNA SOLA VEZ, DESPUÉS de aplicar la vista stock_actual y de
-- desplegar el frontend corregido. El guard NOT EXISTS evita doble ejecución.

begin;

with correcciones as (
  select producto_id, ubicacion_id, max(created_at) as ultima_correccion
  from public.producto_inventario
  where tipo = 'ajuste'
    and nota ilike 'correc%'
  group by producto_id, ubicacion_id
),
compensacion as (
  select
    c.producto_id,
    c.ubicacion_id,
    c.ultima_correccion,
    coalesce(sum(pv.cantidad), 0) as unidades
  from correcciones c
  left join public.producto_ventas pv
    on pv.producto_id = c.producto_id
   and pv.ubicacion_id = c.ubicacion_id
   and pv.id > 1073                      -- ventas fuera de la ventana de 1000
   and pv.created_at < c.ultima_correccion
  group by c.producto_id, c.ubicacion_id, c.ultima_correccion
),
precios as (
  -- último ingreso por combinación, para valorar el ajuste igual que la app
  select distinct on (producto_id, ubicacion_id)
    producto_id, ubicacion_id, precio_venta, costo_unitario
  from public.producto_inventario
  where tipo = 'ingreso'
  order by producto_id, ubicacion_id, created_at desc, id desc
)
insert into public.producto_inventario
  (producto_id, ubicacion_id, cantidad, precio_venta, costo_unitario,
   creado_por, nota, tipo)
select
  comp.producto_id,
  comp.ubicacion_id,
  comp.unidades,
  coalesce(pr.precio_venta, 0),
  coalesce(pr.costo_unitario, 0),
  null,
  'Conciliación automática 2026-08-10: devuelve ventas no visibles por el '
    || 'límite de 1000 filas que la corrección manual del '
    || to_char(comp.ultima_correccion at time zone 'America/Costa_Rica', 'DD/MM/YYYY')
    || ' ya había descontado',
  'ajuste'
from compensacion comp
left join precios pr
  on pr.producto_id = comp.producto_id
 and pr.ubicacion_id = comp.ubicacion_id
where comp.unidades > 0
  and not exists (
    select 1 from public.producto_inventario
    where nota like 'Conciliación automática 2026-08-10%'
  );

commit;

-- Verificación sugerida después de ejecutar:
--   select p.nombre, u.nombre, s.stock
--   from public.stock_actual s
--   join productos p on p.id = s.producto_id
--   join ubicaciones u on u.id = s.ubicacion_id
--   where s.stock < 0
--   order by s.stock;
-- Esperado: solo quedan Jet/Guadalupe (-2) y Medias Antideslizantes/
-- Sabana Mitad de Cuadra (-1), diferencias reales previas al bug que el
-- cliente puede cuadrar con el flujo "Corregir".
