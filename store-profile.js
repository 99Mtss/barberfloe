(() => {
    "use strict";

    const image = document.querySelector("#store-profile-image");
    const heroArt = image && image.closest(".hero-art");
    const decoration = heroArt && heroArt.querySelector(".hero-art-decoration");
    const app = window.barberflow;
    if (!image || !heroArt || !decoration || !app || !app.isConfigured) return;

    async function loadProfileImage() {
        const { data: settings, error } = await app.client
            .from("store_settings")
            .select("profile_image_path")
            .eq("singleton", true)
            .maybeSingle();
        if (error) throw error;
        if (!settings || !settings.profile_image_path) return;

        const { data } = app.client.storage
            .from("barberflow-profile")
            .getPublicUrl(settings.profile_image_path);

        image.addEventListener("load", () => {
            image.hidden = false;
            decoration.hidden = true;
            heroArt.classList.add("has-profile-image");
        }, { once: true });
        image.addEventListener("error", () => {
            console.error("Não foi possível carregar a foto de perfil da loja.");
        }, { once: true });
        image.src = data.publicUrl;
    }

    loadProfileImage().catch(error => {
        console.error("Não foi possível carregar as configurações da foto de perfil:", error);
    });
})();
