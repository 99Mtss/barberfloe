create or replace function public.enforce_barber_shop_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('barberflow_barbershop_photo_limit')
    );

    if (select pg_catalog.count(*) from public.barber_shop_photos) >= 5 then
        raise exception 'A galeria permite no máximo 5 fotos.';
    end if;

    return new;
end;
$$;

revoke all on function public.enforce_barber_shop_photo_limit() from public, anon, authenticated;

drop trigger if exists barber_shop_photos_enforce_limit on public.barber_shop_photos;
create trigger barber_shop_photos_enforce_limit
    before insert on public.barber_shop_photos
    for each row execute function public.enforce_barber_shop_photo_limit();
