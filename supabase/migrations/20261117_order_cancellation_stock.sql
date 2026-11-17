create or replace function public.update_barberflow_order_stock_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_item record;
begin
    if new.status = old.status then
        return new;
    end if;

    for v_item in
        select
            (item.value ->> 'id')::uuid as product_id,
            sum((item.value ->> 'quantidade')::integer)::integer as quantity
        from jsonb_array_elements(old.items) as item(value)
        group by (item.value ->> 'id')::uuid
    loop
        if new.status = 'cancelled' then
            update public.products
            set stock = stock + v_item.quantity
            where id = v_item.product_id;

            if not found then
                raise exception 'Um produto do pedido não foi encontrado para retornar ao estoque.';
            end if;
        elsif old.status = 'cancelled' then
            update public.products
            set stock = stock - v_item.quantity
            where id = v_item.product_id
                and stock >= v_item.quantity;

            if not found then
                raise exception 'Estoque insuficiente para reativar o pedido.';
            end if;
        end if;
    end loop;

    return new;
end;
$$;

revoke all on function public.update_barberflow_order_stock_on_status_change()
    from public, anon, authenticated;

drop trigger if exists orders_update_stock_on_status_change on public.orders;
create trigger orders_update_stock_on_status_change
    before update of status on public.orders
    for each row execute function public.update_barberflow_order_stock_on_status_change();
