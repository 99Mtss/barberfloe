(() => {
    "use strict";

    document.body.classList.add("is-auth-pending");

    const sidebar = document.querySelector(".admin-sidebar");
    const menuContainer = document.querySelector(".admin-user");
    const adminLayout = document.querySelector(".admin-layout");

    if (sidebar && menuContainer && adminLayout) {
        const menuToggle = document.createElement("button");
        menuToggle.className = "admin-menu-toggle";
        menuToggle.type = "button";
        menuToggle.setAttribute("aria-label", "Abrir menu");
        menuToggle.setAttribute("aria-controls", "admin-navigation");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        menuContainer.prepend(menuToggle);

        const closeButton = document.createElement("button");
        closeButton.className = "admin-menu-close";
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Fechar menu");
        closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        sidebar.prepend(closeButton);

        const navigation = sidebar.querySelector(".admin-nav");
        if (navigation) navigation.id = "admin-navigation";

        const backdrop = document.createElement("button");
        backdrop.className = "admin-nav-backdrop";
        backdrop.type = "button";
        backdrop.setAttribute("aria-label", "Fechar menu");
        backdrop.hidden = true;
        adminLayout.insertBefore(backdrop, sidebar.nextSibling);

        const closeMenu = () => {
            sidebar.classList.remove("is-open");
            sidebar.setAttribute("aria-hidden", "true");
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Abrir menu");
            backdrop.hidden = true;
            document.body.classList.remove("is-admin-menu-open");
        };

        const openMenu = () => {
            sidebar.classList.add("is-open");
            sidebar.setAttribute("aria-hidden", "false");
            menuToggle.setAttribute("aria-expanded", "true");
            menuToggle.setAttribute("aria-label", "Fechar menu");
            backdrop.hidden = false;
            document.body.classList.add("is-admin-menu-open");
            closeButton.focus();
        };

        menuToggle.addEventListener("click", () => {
            if (sidebar.classList.contains("is-open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });
        closeButton.addEventListener("click", () => {
            closeMenu();
            menuToggle.focus();
        });
        backdrop.addEventListener("click", () => {
            closeMenu();
            menuToggle.focus();
        });
        sidebar.querySelectorAll(".admin-nav-link").forEach(link => {
            link.addEventListener("click", closeMenu);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
                closeMenu();
                menuToggle.focus();
            }
        });
        const desktopViewport = window.matchMedia("(min-width: 761px)");
        const updateSidebarAccessibility = event => {
            if (event.matches) closeMenu();
            sidebar.setAttribute("aria-hidden", event.matches ? "false" : "true");
        };
        sidebar.setAttribute("aria-hidden", desktopViewport.matches ? "false" : "true");
        desktopViewport.addEventListener("change", updateSidebarAccessibility);
    }

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
