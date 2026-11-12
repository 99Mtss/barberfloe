import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_BODY_BYTES = 16_384;
const MAX_ITEMS = 20;
const MAX_QUANTITY = 99;
const MAX_ORDERS_PER_WINDOW = 3;
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
        console.error("Configuração ausente: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
        return response({ error: "O serviço de pedidos não está configurado." }, 503, origin);
    }

    const clientIp = request.headers.get("x-real-ip")?.trim()
        || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!clientIp || clientIp.length > 64) {
        console.error("Não foi possível identificar o IP do cliente para limitar pedidos.");
        return response({ error: "Não foi possível validar o limite de pedidos. Tente novamente mais tarde." }, 503, origin);
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
        items?: unknown;
    };
    const customerName = typeof orderPayload.customer_name === "string"
        ? orderPayload.customer_name.trim()
        : "";
    const items = orderPayload.items;

    if (customerName.length < 1 || customerName.length > 120) {
        return response({ error: "Informe um nome com até 120 caracteres." }, 400, origin);
    }

    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
        return response({ error: "Revise os itens do seu pedido." }, 400, origin);
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

    let ipHash: string;
    try {
        const hmacKey = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(serviceRoleKey),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );
        const digest = await crypto.subtle.sign(
            "HMAC",
            hmacKey,
            new TextEncoder().encode(clientIp)
        );
        ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
        console.error("Could not hash the client IP for order rate limiting:", error);
        return response({ error: "O serviço de pedidos está temporariamente indisponível." }, 503, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data, error } = await supabase.rpc("create_limited_barberflow_order", {
        p_customer_name: customerName,
        p_items: Array.from(requestedItems, ([product_id, quantity]) => ({
            product_id,
            quantity
        })),
        p_ip_hash: ipHash
    });

    if (error) {
        console.error("Order RPC rejected a request:", error);
        if (error.code === "P4290") {
            return response(
                { error: `Limite de ${MAX_ORDERS_PER_WINDOW} pedidos a cada 15 minutos atingido. Aguarde antes de tentar novamente.` },
                429,
                origin
            );
        }
        if (error.code === "PGRST202" || error.code === "42883") {
            return response(
                { error: "O checkout ainda não foi atualizado no Supabase. Execute a migração 20261112_order_rate_limit.sql e publique novamente a Edge Function create-order." },
                503,
                origin
            );
        }
        const status = error.code === "P0001" || error.code === "23514" ? 400 : 500;
        const message = status === 400
            ? error.message
            : "Não foi possível registrar o pedido. Tente novamente.";
        return response({ error: message }, status, origin);
    }

    return response(data, 200, origin);
});
