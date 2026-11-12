revoke all on function public.create_barberflow_order(text, jsonb)
    from public, anon, authenticated;

grant execute on function public.create_barberflow_order(text, jsonb)
    to service_role;

create table if not exists public.order_rate_limits (
    ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
    window_started_at timestamptz not null default now(),
    request_count smallint not null check (request_count between 1 and 4)
);

create index if not exists order_rate_limits_window_started_at_idx
    on public.order_rate_limits (window_started_at);

alter table public.order_rate_limits enable row level security;
revoke all on table public.order_rate_limits from public, anon, authenticated;

create or replace function public.create_limited_barberflow_order(
    p_customer_name text,
    p_items jsonb,
    p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_request_count smallint;
begin
    if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
        raise exception 'A identificação do cliente é inválida.';
    end if;

    delete from public.order_rate_limits
    where window_started_at < now() - interval '1 day';

    insert into public.order_rate_limits (ip_hash, window_started_at, request_count)
    values (p_ip_hash, now(), 1)
    on conflict (ip_hash) do update
    set window_started_at = case
            when public.order_rate_limits.window_started_at <= now() - interval '15 minutes'
                then now()
            else public.order_rate_limits.window_started_at
        end,
        request_count = case
            when public.order_rate_limits.window_started_at <= now() - interval '15 minutes'
                then 1
            else least(public.order_rate_limits.request_count + 1, 4)
        end
    returning request_count into v_request_count;

    if v_request_count > 3 then
        raise exception using
            errcode = 'P4290',
            message = 'Limite de pedidos atingido. Aguarde antes de tentar novamente.';
    end if;

    return public.create_barberflow_order(p_customer_name, p_items);
end;
$$;

revoke all on function public.create_limited_barberflow_order(text, jsonb, text)
    from public, anon, authenticated;

grant execute on function public.create_limited_barberflow_order(text, jsonb, text)
    to service_role;
