(() => {
    "use strict";

    const BUCKET = "barberflow-barbershop";
    const gallery = document.querySelector("#barbershop-gallery");
    const emptyState = document.querySelector("#barbershop-gallery-empty");
    const viewer = document.querySelector("#barbershop-photo-viewer");
    const viewerImage = document.querySelector("#barbershop-photo-viewer-image");
    const viewerDescription = document.querySelector("#barbershop-photo-viewer-description");
    if (!gallery || !emptyState) return;

    gallery.hidden = true;
    emptyState.hidden = true;

    async function loadPhotos() {
        const app = window.barberflow;
        if (!app || !app.isConfigured) {
            emptyState.textContent = "As fotos da barbearia estão indisponíveis no momento.";
            emptyState.hidden = false;
            return;
        }

        const { data, error } = await app.client
            .from("barber_shop_photos")
            .select("id, storage_path, alt_text")
            .order("created_at", { ascending: false })
            .limit(5);
        if (error) throw error;

        gallery.replaceChildren();
        data.forEach(photo => {
            const { data: publicUrl } = app.client.storage
                .from(BUCKET)
                .getPublicUrl(photo.storage_path);
            const image = document.createElement("img");
            image.src = publicUrl.publicUrl;
            image.alt = photo.alt_text || "Foto da barbearia BarberFlow";
            image.loading = "lazy";
            image.decoding = "async";
            const item = document.createElement("button");
            item.className = "barbershop-gallery-item";
            item.type = "button";
            item.setAttribute("aria-label", photo.alt_text
                ? `Ampliar foto: ${photo.alt_text}`
                : "Ampliar foto da barbearia");
            item.append(image);
            item.addEventListener("click", () => {
                viewerImage.src = publicUrl.publicUrl;
                viewerImage.alt = image.alt;
                viewerDescription.textContent = photo.alt_text || "Barbearia BarberFlow";
                viewer.showModal();
            });
            gallery.append(item);
        });
        emptyState.hidden = data.length > 0;
        gallery.hidden = data.length === 0;
    }

    loadPhotos().catch(error => {
        console.error("Erro ao carregar fotos da barbearia:", error);
        gallery.hidden = true;
        emptyState.textContent = "Não foi possível carregar as fotos da barbearia.";
        emptyState.hidden = false;
    });

    viewer.addEventListener("click", event => {
        if (event.target === viewer) viewer.close();
    });
    document.querySelector("#barbershop-photo-viewer-close")
        .addEventListener("click", () => viewer.close());
})();
