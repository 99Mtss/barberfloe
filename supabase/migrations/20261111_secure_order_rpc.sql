-- Run after deploying the create-order Edge Function.
-- Public orders must go through the server-side CAPTCHA verification.
revoke all on function public.create_barberflow_order(text, jsonb)
    from public, anon, authenticated;

grant execute on function public.create_barberflow_order(text, jsonb)
    to service_role;
