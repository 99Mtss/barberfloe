(() => {
    "use strict";

    const BUCKET = "barberflow-barbershop";
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    const form = document.querySelector("#barbershop-photo-form");
    const list = document.querySelector("#barbershop-photo-list");
    const empty = document.querySelector("#barbershop-photo-empty");
    const count = document.querySelector("#barbershop-photo-count");
    const notice = document.querySelector("#barbershop-notice");
    const fileInput = document.querySelector("#barbershop-photo-file");
    const uploadButton = form.querySelector('[type="submit"]');

    function showNotice(message, type = "success") {
        notice.textContent = message;
        notice.className = `admin-notice${type === "error" ? " is-error" : ""}`;
        notice.hidden = false;
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getClient() {
        const app = window.barberflow;
        if (!app || !app.isConfigured) {
            throw new Error(app && app.error ? app.error : "O Supabase ainda não está configurado.");
        }
        return app.client;
    }

    async function loadPhotos() {
        const client = getClient();
        const { data, error } = await client
            .from("barber_shop_photos")
            .select("id, storage_path, alt_text, created_at")
            .order("created_at", { ascending: false });
        if (error) throw error;

        count.textContent = `${data.length}/5 ${data.length === 1 ? "foto publicada" : "fotos publicadas"}`;
        empty.hidden = data.length > 0;
        fileInput.disabled = data.length >= 5;
        uploadButton.disabled = data.length >= 5;
        uploadButton.querySelector("span").textContent = data.length >= 5
            ? "Limite de fotos atingido"
            : "Enviar foto";
        list.innerHTML = data.map(photo => {
            const { data: publicUrl } = client.storage.from(BUCKET).getPublicUrl(photo.storage_path);
            return `<article class="admin-gallery-card">
                <img src="${escapeHTML(publicUrl.publicUrl)}" alt="${escapeHTML(photo.alt_text || "Foto da barbearia")}">
                <div class="admin-gallery-card-footer">
                    <span>${escapeHTML(photo.alt_text || "Foto da barbearia")}</span>
                    <button class="admin-icon-button is-danger" type="button" data-delete-photo="${escapeHTML(photo.id)}" aria-label="Excluir foto" title="Excluir foto">
                        <i class="fa-solid fa-trash" aria-hidden="true"></i>
                    </button>
                </div>
            </article>`;
        }).join("");
        for (let slot = data.length; slot < 5; slot++) {
            list.insertAdjacentHTML("beforeend", `<div class="admin-gallery-slot" aria-label="Espaço vazio ${slot + 1} de 5">
                <i class="fa-regular fa-image" aria-hidden="true"></i>
                <span>Foto ${slot + 1}</span>
            </div>`);
        }
    }

    async function uploadPhoto(file, altText) {
        if (!ALLOWED_TYPES.has(file.type)) {
            throw new Error("Use uma imagem JPG, PNG, WebP ou GIF.");
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error("A imagem deve ter no máximo 5 MB.");
        }

        const extensionByType = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"
        };
        const client = getClient();
        const path = `${crypto.randomUUID()}.${extensionByType[file.type]}`;
        const { error: uploadError } = await client.storage
            .from(BUCKET)
            .upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { error: insertError } = await client
            .from("barber_shop_photos")
            .insert({ storage_path: path, alt_text: altText });
        if (insertError) {
            const { error: cleanupError } = await client.storage.from(BUCKET).remove([path]);
            if (cleanupError) console.error("Erro ao limpar arquivo após falha no cadastro:", cleanupError);
            throw insertError;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            showNotice("Selecione uma foto antes de enviar.", "error");
            return;
        }

        uploadButton.disabled = true;
        try {
            const altText = document.querySelector("#barbershop-photo-alt").value.trim();
            await uploadPhoto(file, altText);
            form.reset();
            await loadPhotos();
            showNotice("Foto adicionada à galeria da loja.");
        } catch (error) {
            console.error("Erro ao enviar foto da barbearia:", error);
            showNotice(`Não foi possível enviar a foto. ${error.message || "Tente novamente."}`, "error");
        } finally {
            if (Number.parseInt(count.textContent, 10) < 5) uploadButton.disabled = false;
        }
    });

    list.addEventListener("click", async event => {
        const button = event.target.closest("[data-delete-photo]");
        if (!button || !window.confirm("Excluir esta foto da galeria?")) return;
        button.disabled = true;
        try {
            const client = getClient();
            const { data: photo, error: fetchError } = await client
                .from("barber_shop_photos")
                .select("id, storage_path")
                .eq("id", button.dataset.deletePhoto)
                .single();
            if (fetchError) throw fetchError;

            const { error: deleteRowError } = await client
                .from("barber_shop_photos")
                .delete()
                .eq("id", photo.id);
            if (deleteRowError) throw deleteRowError;

            await loadPhotos();
            const { error: deleteFileError } = await client.storage.from(BUCKET).remove([photo.storage_path]);
            if (deleteFileError) {
                console.error("A foto saiu da galeria, mas não foi possível limpar o arquivo:", deleteFileError);
                showNotice("Foto removida da galeria, mas não foi possível limpar o arquivo do armazenamento.", "error");
                return;
            }
            showNotice("Foto removida da galeria.");
        } catch (error) {
            console.error("Erro ao excluir foto da barbearia:", error);
            showNotice(`Não foi possível excluir a foto. ${error.message || "Tente novamente."}`, "error");
            button.disabled = false;
        }
    });

    (async () => {
        if (!await window.barberflowAdminReady) return;
        try {
            await loadPhotos();
        } catch (error) {
            console.error("Erro ao carregar fotos da barbearia:", error);
            count.textContent = "Falha ao carregar as fotos.";
            showNotice(`Não foi possível carregar a galeria. ${error.message || "Tente novamente."}`, "error");
        }
    })();
})();
