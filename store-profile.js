(() => {
    "use strict";

    const image = document.querySelector("#store-profile-image");
    const heroArt = image && image.closest(".hero-art");
    const decoration = heroArt && heroArt.querySelector(".hero-art-decoration");
    const profileIconImages = document.querySelectorAll(".store-profile-mark-image, .store-profile-icon-image");
    const hero = document.querySelector(".hero");
    const app = window.barberflow;
    const STORE_IMAGES_BUCKET = "barberflow-profile";
    if (!app || !app.isConfigured) return;

    function renderProfileImage(path) {
        profileIconImages.forEach(profileIconImage => {
            const container = profileIconImage.closest(".logo-mark, .admin-brand-mark, .profile-icon-wrap");
            profileIconImage.hidden = true;
            profileIconImage.removeAttribute("src");
            if (container) container.classList.remove("has-profile-image");
            if (!path) return;

            const { data } = app.client.storage
                .from(STORE_IMAGES_BUCKET)
                .getPublicUrl(path);
            profileIconImage.addEventListener("load", () => {
                if (profileIconImage.src !== data.publicUrl) return;
                profileIconImage.hidden = false;
                if (container) container.classList.add("has-profile-image");
            }, { once: true });
            profileIconImage.addEventListener("error", () => {
                if (profileIconImage.src !== data.publicUrl) return;
                console.error("Não foi possível carregar a foto de perfil em um ícone.");
            }, { once: true });
            profileIconImage.src = data.publicUrl;
        });

        if (!image || !heroArt || !decoration) return;
        image.hidden = true;
        image.removeAttribute("src");
        decoration.hidden = false;
        heroArt.classList.remove("has-profile-image");
        if (!path) return;
        const { data } = app.client.storage
            .from(STORE_IMAGES_BUCKET)
            .getPublicUrl(path);
        image.addEventListener("load", () => {
            if (image.src !== data.publicUrl) return;
            image.hidden = false;
            decoration.hidden = true;
            heroArt.classList.add("has-profile-image");
        }, { once: true });
        image.addEventListener("error", () => {
            if (image.src !== data.publicUrl) return;
            console.error("Não foi possível carregar a foto de perfil da loja.");
        }, { once: true });
        image.src = data.publicUrl;
    }

    async function loadStoreImages() {
        const { data: settings, error } = await app.client
            .from("store_settings")
            .select("profile_image_path")
            .eq("singleton", true)
            .maybeSingle();
        if (error) throw error;
        renderProfileImage(settings && settings.profile_image_path || "");
    }

    async function loadHeroBanner() {
        const { data: settings, error } = await app.client
            .from("store_settings")
            .select("hero_banner_path")
            .eq("singleton", true)
            .maybeSingle();
        if (error) throw error;
        if (settings) applyHeroBanner(settings.hero_banner_path);
    }

    function applyHeroBanner(path) {
        if (!hero || !path) return;
        const { data } = app.client.storage
            .from(STORE_IMAGES_BUCKET)
            .getPublicUrl(path);
        const preload = new Image();

        preload.addEventListener("load", () => {
            hero.style.setProperty("--hero-banner-image", `url("${data.publicUrl}")`);
        }, { once: true });
        preload.addEventListener("error", () => {
            console.error("Não foi possível carregar o banner da loja.");
        }, { once: true });
        preload.src = data.publicUrl;
    }

    loadStoreImages().catch(error => {
        console.error("Não foi possível carregar as imagens da loja:", error);
    });
    window.addEventListener("store-profile-updated", event => {
        renderProfileImage(event.detail && event.detail.path || "");
    });
    if (hero) {
        loadHeroBanner().catch(error => {
            console.error("Não foi possível carregar o banner da loja:", error);
        });
    }
})();
