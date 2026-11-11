(() => {
    "use strict";

    document.body.classList.add("is-auth-pending");

    window.barberflowAdminReady = (async () => {
        const app = window.barberflow;
        if (!app || !app.isConfigured) {
            window.location.replace("login.html");
            return false;
        }

        try {
            const { data, error } = await app.client.auth.getSession();
            if (error) throw error;
            if (!data.session) {
                window.location.replace("login.html");
                return false;
            }

            const { data: access, error: accessError } = await app.client
                .from("admin_users")
                .select("user_id")
                .eq("user_id", data.session.user.id)
                .maybeSingle();

            if (accessError) throw accessError;
            if (!access) {
                await app.client.auth.signOut();
                window.location.replace("login.html");
                return false;
            }

            const logoutButton = document.querySelector("#admin-logout");
            if (logoutButton) {
                logoutButton.addEventListener("click", async () => {
                    logoutButton.disabled = true;
                    const { error: signOutError } = await app.client.auth.signOut();
                    if (signOutError) {
                        console.error("Erro ao sair do painel:", signOutError);
                        logoutButton.disabled = false;
                        return;
                    }
                    window.location.replace("login.html");
                });
            }

            app.client.auth.onAuthStateChange(event => {
                if (event === "SIGNED_OUT") {
                    window.location.replace("login.html");
                }
            });
            document.body.classList.remove("is-auth-pending");
            return true;
        } catch (error) {
            console.error("Erro ao validar o acesso administrativo:", error);
            window.location.replace("login.html?erro=acesso");
            return false;
        }
    })();
})();
