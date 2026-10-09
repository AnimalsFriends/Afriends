-- FASE 5: evita que dos abonos simultáneos dejen un cobro sobrepagado.
-- La fila del cobro se bloquea antes de sumar abonos para serializar los cobros
-- concurrentes; también se impide reducir el valor de una factura ya abonada.
create or replace function public.tg_validar_abono_en_saldo()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_total numeric(14, 2);
  v_abonado numeric(14, 2);
begin
  if tg_op = 'UPDATE' and old.pago_id <> new.pago_id then
    perform id
      from public.pagos
     where id in (old.pago_id, new.pago_id)
     order by id
     for update;
  else
    perform id
      from public.pagos
     where id = new.pago_id
     for update;
  end if;

  select valor_total into v_total
    from public.pagos
   where id = new.pago_id;

  if v_total is null then
    raise exception 'El cobro indicado no existe.' using errcode = '23503';
  end if;

  select coalesce(sum(a.valor), 0) into v_abonado
    from public.abonos as a
   where a.pago_id = new.pago_id
     and (tg_op <> 'UPDATE' or a.id <> new.id);

  if v_abonado + new.valor > v_total then
    raise exception 'El abono supera el saldo pendiente del cobro.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tg_abonos_no_sobrepagar on public.abonos;
create trigger tg_abonos_no_sobrepagar
  before insert or update on public.abonos
  for each row execute function public.tg_validar_abono_en_saldo();

create or replace function public.tg_validar_total_pago()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_abonado numeric(14, 2);
begin
  if new.valor_total < old.valor_total then
    select coalesce(sum(a.valor), 0) into v_abonado
      from public.abonos as a
     where a.pago_id = old.id;
    if new.valor_total < v_abonado then
      raise exception 'El total no puede quedar por debajo de los abonos recibidos.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_pagos_respetar_abonos on public.pagos;
create trigger tg_pagos_respetar_abonos
  before update of valor_total on public.pagos
  for each row execute function public.tg_validar_total_pago();
