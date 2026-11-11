import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES = 16_384;
const MAX_ITEMS = 20;
const MAX_QUANTITY = 99;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAllowedOrigins(): Set<string> {
    return new Set(
        (Deno.env.get("ALLOWED_ORIGINS") || "")
            .split(",")
            .map(origin => origin.trim().replace(/\/+$/, ""))
            .filter(Boolean)
    );
}

function response(
    body: Record<string, unknown>,
    status: number,
    origin: string | null
): Response {
    const headers = new Headers({
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Vary": "Origin"
    });

    if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    }

    return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async request => {
    const requestOrigin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins();
    const origin = requestOrigin?.replace(/\/+$/, "") || null;

    if (!origin || !allowedOrigins.has(origin)) {
        return response({ error: "Origem não autorizada." }, 403, null);
    }

    if (request.method === "OPTIONS") {
        return response({ ok: true }, 200, origin);
    }

    if (request.method !== "POST") {
        return response({ error: "Método não permitido." }, 405, origin);
    }

    const siteVerifySecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!siteVerifySecret || !supabaseUrl || !serviceRoleKey) {
        console.error("Configuração ausente: TURNSTILE_SECRET_KEY, SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
        return response({ error: "O serviço de pedidos não está configurado." }, 503, origin);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
        return response({ error: "Solicitação muito grande." }, 413, origin);
    }

    let payload: unknown;

    try {
        payload = await request.json();
    } catch {
        return response({ error: "Corpo da solicitação inválido." }, 400, origin);
    }

    if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_BODY_BYTES) {
        return response({ error: "Solicitação muito grande." }, 413, origin);
    }

    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        return response({ error: "Corpo da solicitação inválido." }, 400, origin);
    }

    const orderPayload = payload as {
        customer_name?: unknown;
        captcha_token?: unknown;
        items?: unknown;
    };
    const customerName = typeof orderPayload.customer_name === "string"
        ? orderPayload.customer_name.trim()
        : "";
    const captchaToken = typeof orderPayload.captcha_token === "string"
        ? orderPayload.captcha_token
        : "";
    const items = orderPayload.items;

    if (customerName.length < 1 || customerName.length > 120) {
        return response({ error: "Informe um nome com até 120 caracteres." }, 400, origin);
    }

    if (
        !captchaToken
        || captchaToken.length > 2048
        || !Array.isArray(items)
        || items.length < 1
        || items.length > MAX_ITEMS
    ) {
        return response({ error: "Conclua a verificação de segurança e revise sua sacola." }, 400, origin);
    }

    const requestedItems = new Map<string, number>();
    for (const item of items) {
        if (
            !item
            || typeof item !== "object"
            || Array.isArray(item)
        ) {
            return response({ error: "Um item ou uma quantidade do pedido é inválida." }, 400, origin);
        }

        const orderItem = item as { product_id?: unknown; quantity?: unknown };
        if (
            typeof orderItem.product_id !== "string"
            || !UUID_PATTERN.test(orderItem.product_id)
            || typeof orderItem.quantity !== "number"
            || !Number.isInteger(orderItem.quantity)
            || orderItem.quantity < 1
            || orderItem.quantity > MAX_QUANTITY
        ) {
            return response({ error: "Um item ou uma quantidade do pedido é inválida." }, 400, origin);
        }

        const productId = orderItem.product_id;
        const itemQuantity = orderItem.quantity;
        const quantity = (requestedItems.get(productId) || 0) + itemQuantity;
        if (quantity > MAX_QUANTITY) {
            return response({ error: "A quantidade máxima por produto é 99." }, 400, origin);
        }
        requestedItems.set(productId, quantity);
    }

    const turnstileBody = new URLSearchParams({
        secret: siteVerifySecret,
        response: captchaToken,
        idempotency_key: crypto.randomUUID()
    });

    try {
        const verificationResponse = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: turnstileBody,
                signal: AbortSignal.timeout(8000)
            }
        );

        if (!verificationResponse.ok) {
            console.error("Turnstile verification endpoint returned", verificationResponse.status);
            return response({ error: "Não foi possível verificar a segurança. Tente novamente." }, 502, origin);
        }

        const verification = await verificationResponse.json();
        const allowedHostnames = new Set(
            (Deno.env.get("TURNSTILE_ALLOWED_HOSTNAMES") || "")
                .split(",")
                .map(hostname => hostname.trim().toLowerCase())
                .filter(Boolean)
        );
        const originHostname = new URL(origin).hostname.toLowerCase();
        const hostnameAllowed = allowedHostnames.size > 0
            ? allowedHostnames.has(String(verification.hostname || "").toLowerCase())
            : String(verification.hostname || "").toLowerCase() === originHostname;

        if (
            !verification.success
            || verification.action !== "checkout"
            || !hostnameAllowed
        ) {
            console.warn("Turnstile rejected a checkout request.", verification["error-codes"] || []);
            return response({ error: "A verificação de segurança expirou ou não foi aprovada. Tente novamente." }, 400, origin);
        }
    } catch (error) {
        console.error("Turnstile verification failed:", error);
        return response({ error: "Não foi possível verificar a segurança. Tente novamente." }, 502, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data, error } = await supabase.rpc("create_barberflow_order", {
        p_customer_name: customerName,
        p_items: Array.from(requestedItems, ([product_id, quantity]) => ({
            product_id,
            quantity
        }))
    });

    if (error) {
        console.error("Order RPC rejected a verified request:", error);
        const status = error.code === "P0001" || error.code === "23514" ? 400 : 500;
        const message = status === 400
            ? error.message
            : "Não foi possível registrar o pedido. Tente novamente.";
        return response({ error: message }, status, origin);
    }

    return response(data, 200, origin);
});
