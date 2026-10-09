-- Quita las protecciones nuevas, pero no elimina ni modifica cobros o abonos.
drop trigger if exists tg_pagos_respetar_abonos on public.pagos;
drop trigger if exists tg_abonos_no_sobrepagar on public.abonos;
drop function if exists public.tg_validar_total_pago();
drop function if exists public.tg_validar_abono_en_saldo();
