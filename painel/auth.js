(() => {
    "use strict";

    const form = document.querySelector("#login-form");
    const message = document.querySelector("#auth-message");
    const app = window.barberflow;

    function showMessage(text) {
        message.textContent = text;
        message.hidden = false;
    }

    async function hasAdminAccess(client, userId) {
        const { data, error } = await client
            .from("admin_users")
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) throw error;
        return Boolean(data);
    }

    if (!app || !app.isConfigured) {
        showMessage(app && app.error
            ? app.error
            : "O painel ainda não está conectado. Configure a URL e a chave pública do projeto Supabase antes de entrar.");
        return;
    }

    const client = app.client;
    form.hidden = false;

    client.auth.getSession().then(async ({ data, error }) => {
        if (error) throw error;
        if (data.session && await hasAdminAccess(client, data.session.user.id)) {
            window.location.replace("admin.html");
        }
    }).catch(error => {
        console.error("Erro ao verificar a sessão administrativa:", error);
        showMessage("Não foi possível verificar o acesso. Tente novamente.");
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const originalLabel = button.innerHTML;
        button.disabled = true;
        button.textContent = "Verificando acesso...";
        message.hidden = true;

        try {
            const formData = new FormData(form);
            const { data, error } = await client.auth.signInWithPassword({
                email: String(formData.get("email")).trim(),
                password: String(formData.get("password"))
            });

            if (error) throw error;
            if (!await hasAdminAccess(client, data.user.id)) {
                await client.auth.signOut();
                showMessage("Esta conta não tem permissão para acessar o painel.");
                return;
            }

            window.location.replace("admin.html");
        } catch (error) {
            console.error("Erro no login administrativo:", error);
            showMessage("Não foi possível entrar. Confira o e-mail e a senha ou tente novamente.");
        } finally {
            button.disabled = false;
            button.innerHTML = originalLabel;
        }
    });
})();
