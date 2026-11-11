(() => {
    "use strict";

    const config = window.BARBERFLOW_SUPABASE_CONFIG || {};
    const isConfigured = Boolean(config.url && config.anonKey);

    if (!isConfigured) {
        window.barberflow = {
            isConfigured: false,
            client: null
        };
        return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        window.barberflow = {
            isConfigured: false,
            client: null,
            error: "A biblioteca do Supabase não foi carregada."
        };
        console.error(window.barberflow.error);
        return;
    }

    window.barberflow = {
        isConfigured: true,
        client: window.supabase.createClient(config.url, config.anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        })
    };
})();
