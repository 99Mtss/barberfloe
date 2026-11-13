(() => {
    "use strict";

    const PROFILE_BUCKET = "barberflow-profile";
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_PROFILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
    const notice = document.querySelector("#settings-notice");
    const couponForm = document.querySelector("#coupon-form");
    const couponBody = document.querySelector("#coupon-table-body");
    const promotionBody = document.querySelector("#promotion-table-body");
    const profileForm = document.querySelector("#profile-photo-form");
    const profileFile = document.querySelector("#profile-photo-file");
    const profilePreview = document.querySelector("#profile-photo-preview");
    const profileEmpty = document.querySelector("#profile-photo-empty");
    const profileRemove = document.querySelector("#profile-photo-remove");
    let coupons = [];
    let products = [];
    let editingCode = null;
    let profilePath = "";
    let previewUrl = "";

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showNotice(message, type = "success") {
        notice.textContent = message;
        notice.className = `admin-notice${type === "error" ? " is-error" : ""}`;
        notice.hidden = false;
        notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function getClient() {
        const app = window.barberflow;
        if (!app || !app.isConfigured) {
            throw new Error(app && app.error ? app.error : "O Supabase ainda não está configurado.");
        }
        return app.client;
    }

    function formatPrice(value) {
        return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatDate(value) {
        if (!value) return "Sem limite";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Data inválida";
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function toLocalDateTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    }

    function readDateTime(value, label) {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error(`Confira a data de ${label}.`);
        return date.toISOString();
    }

    function validateDates(start, end) {
        if (start && end && new Date(end) <= new Date(start)) {
            throw new Error("A data final precisa ser posterior à data inicial.");
        }
    }

    function resetCouponForm() {
        couponForm.reset();
        editingCode = null;
        couponForm.elements.namedItem("code").disabled = false;
        document.querySelector("#coupon-submit-label").textContent = "Criar cupom";
        document.querySelector("#coupon-cancel-edit").hidden = true;
    }

    function renderCoupons() {
        const empty = document.querySelector("#coupon-empty");
        empty.hidden = coupons.length > 0;
        couponBody.innerHTML = coupons.map(coupon => {
            const usage = coupon.usage_limit === null
                ? `${coupon.usage_count} / Ilimitado`
                : `${coupon.usage_count} / ${coupon.usage_limit}`;
            const validity = coupon.starts_at
                ? `${formatDate(coupon.starts_at)} – ${formatDate(coupon.expires_at)}`
                : coupon.expires_at
                    ? `Até ${formatDate(coupon.expires_at)}`
                    : "Sem validade";
            return `<tr>
                <td class="admin-product-name">${escapeHTML(coupon.code)}</td>
                <td>${Number(coupon.discount_percent).toLocaleString("pt-BR")}%</td>
                <td>${escapeHTML(validity)}</td>
                <td>${escapeHTML(usage)}</td>
                <td><span class="admin-order-status ${coupon.active ? "is-complete" : "is-cancelled"}">${coupon.active ? "Ativo" : "Inativo"}</span></td>
                <td><div class="admin-row-actions">
                    <button class="admin-icon-button" type="button" data-edit-coupon="${escapeHTML(coupon.code)}" aria-label="Editar cupom ${escapeHTML(coupon.code)}" title="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                    <button class="admin-icon-button" type="button" data-toggle-coupon="${escapeHTML(coupon.code)}" aria-label="${coupon.active ? "Desativar" : "Ativar"} cupom ${escapeHTML(coupon.code)}" title="${coupon.active ? "Desativar" : "Ativar"}"><i class="fa-solid ${coupon.active ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i></button>
                    <button class="admin-icon-button is-danger" type="button" data-delete-coupon="${escapeHTML(coupon.code)}" aria-label="Excluir cupom ${escapeHTML(coupon.code)}" title="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                </div></td>
            </tr>`;
        }).join("");
    }

    async function loadCoupons() {
        const { data, error } = await getClient()
            .from("store_coupons")
            .select("code, discount_percent, starts_at, expires_at, usage_limit, usage_count, active")
            .order("created_at", { ascending: false });
        if (error) throw error;
        coupons = data;
        renderCoupons();
    }

    async function loadProducts() {
        const { data, error } = await getClient()
            .from("products")
            .select("id, name, price, promotion_percent, promotion_starts_at, promotion_ends_at")
            .order("name", { ascending: true });
        if (error) throw error;
        products = data;
        renderPromotions();
    }

    function renderPromotions() {
        const empty = document.querySelector("#promotion-empty");
        empty.hidden = products.length > 0;
        promotionBody.innerHTML = products.map(product => `<tr data-promotion-row="${escapeHTML(product.id)}">
            <td class="admin-product-name admin-promotion-product">${escapeHTML(product.name)}</td>
            <td>${formatPrice(product.price)}</td>
            <td><label class="sr-only" for="promotion-percent-${escapeHTML(product.id)}">Desconto para ${escapeHTML(product.name)} em porcentagem</label>
                <input id="promotion-percent-${escapeHTML(product.id)}" data-promotion-percent type="number" min="0.01" max="99.99" step="0.01" value="${product.promotion_percent === null ? "" : escapeHTML(product.promotion_percent)}" placeholder="Sem promoção"></td>
            <td><label class="sr-only" for="promotion-start-${escapeHTML(product.id)}">Início da promoção de ${escapeHTML(product.name)}</label>
                <input id="promotion-start-${escapeHTML(product.id)}" data-promotion-start type="datetime-local" value="${toLocalDateTime(product.promotion_starts_at)}"></td>
            <td><label class="sr-only" for="promotion-end-${escapeHTML(product.id)}">Fim da promoção de ${escapeHTML(product.name)}</label>
                <input id="promotion-end-${escapeHTML(product.id)}" data-promotion-end type="datetime-local" value="${toLocalDateTime(product.promotion_ends_at)}"></td>
            <td><div class="admin-row-actions">
                <button class="admin-icon-button" type="button" data-save-promotion="${escapeHTML(product.id)}" aria-label="Salvar promoção de ${escapeHTML(product.name)}" title="Salvar"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i></button>
                <button class="admin-icon-button is-danger" type="button" data-clear-promotion="${escapeHTML(product.id)}" aria-label="Remover promoção de ${escapeHTML(product.name)}" title="Remover promoção"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div></td>
        </tr>`).join("");
    }

    async function savePromotion(row, productId, clear = false) {
        const button = row.querySelector(`[data-${clear ? "clear" : "save"}-promotion]`);
        button.disabled = true;
        try {
            let record = {
                promotion_percent: null,
                promotion_starts_at: null,
                promotion_ends_at: null
            };
            if (!clear) {
                const rawPercent = row.querySelector("[data-promotion-percent]").value.trim();
                if (!rawPercent) throw new Error("Informe um desconto ou use o botão de remover promoção.");
                const percent = Number(rawPercent);
                if (!Number.isFinite(percent) || percent < 0.01 || percent > 99.99) {
                    throw new Error("O desconto deve estar entre 0,01% e 99,99%.");
                }
                const start = readDateTime(row.querySelector("[data-promotion-start]").value, "início");
                const end = readDateTime(row.querySelector("[data-promotion-end]").value, "fim");
                validateDates(start, end);
                record = {
                    promotion_percent: percent,
                    promotion_starts_at: start,
                    promotion_ends_at: end
                };
            }

            const { error } = await getClient()
                .from("products")
                .update(record)
                .eq("id", productId);
            if (error) throw error;
            await loadProducts();
            showNotice(clear ? "Promoção removida." : "Promoção salva com sucesso.");
        } catch (error) {
            console.error("Erro ao salvar promoção:", error);
            showNotice(`Não foi possível salvar a promoção. ${error.message || "Tente novamente."}`, "error");
            button.disabled = false;
        }
    }

    function initCouponForm() {
        couponForm.elements.namedItem("code").addEventListener("input", event => {
            if (!editingCode) event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        });
        couponForm.addEventListener("submit", async event => {
            event.preventDefault();
            const fields = couponForm.elements;
            const code = fields.namedItem("code").value.trim().toUpperCase();
            const percent = Number(fields.namedItem("percent").value);
            const usageValue = fields.namedItem("usage_limit").value.trim();
            const usageLimit = usageValue ? Number(usageValue) : null;
            if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
                showNotice("O código deve ter de 3 a 30 caracteres: letras, números, hífen ou sublinhado.", "error");
                return;
            }
            if (!Number.isFinite(percent) || percent < 0.01 || percent > 100) {
                showNotice("O desconto deve estar entre 0,01% e 100%.", "error");
                return;
            }
            if (usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1)) {
                showNotice("O limite de usos deve ser um número inteiro maior que zero.", "error");
                return;
            }

            const button = couponForm.querySelector('[type="submit"]');
            button.disabled = true;
            const wasEditing = Boolean(editingCode);
            try {
                const startsAt = readDateTime(fields.namedItem("starts_at").value, "início");
                const expiresAt = readDateTime(fields.namedItem("expires_at").value, "validade");
                validateDates(startsAt, expiresAt);
                const record = {
                    code,
                    discount_percent: percent,
                    starts_at: startsAt,
                    expires_at: expiresAt,
                    usage_limit: usageLimit
                };
                const query = editingCode
                    ? getClient().from("store_coupons").update({
                        discount_percent: percent,
                        starts_at: startsAt,
                        expires_at: expiresAt,
                        usage_limit: usageLimit
                    }).eq("code", editingCode)
                    : getClient().from("store_coupons").insert(record);
                const { error } = await query;
                if (error) throw error;
                await loadCoupons();
                resetCouponForm();
                showNotice(wasEditing ? "Cupom atualizado." : "Cupom criado com sucesso.");
            } catch (error) {
                console.error("Erro ao salvar cupom:", error);
                showNotice(`Não foi possível salvar o cupom. ${error.message || "Tente novamente."}`, "error");
            } finally {
                button.disabled = false;
            }
        });
        document.querySelector("#coupon-cancel-edit").addEventListener("click", resetCouponForm);
    }

    function editCoupon(code) {
        const coupon = coupons.find(item => item.code === code);
        if (!coupon) return;
        editingCode = coupon.code;
        couponForm.elements.namedItem("code").value = coupon.code;
        couponForm.elements.namedItem("code").disabled = true;
        couponForm.elements.namedItem("percent").value = coupon.discount_percent;
        couponForm.elements.namedItem("starts_at").value = toLocalDateTime(coupon.starts_at);
        couponForm.elements.namedItem("expires_at").value = toLocalDateTime(coupon.expires_at);
        couponForm.elements.namedItem("usage_limit").value = coupon.usage_limit ?? "";
        document.querySelector("#coupon-submit-label").textContent = "Salvar alterações";
        document.querySelector("#coupon-cancel-edit").hidden = false;
        couponForm.scrollIntoView({ behavior: "smooth", block: "center" });
        couponForm.elements.namedItem("percent").focus({ preventScroll: true });
    }

    function initCouponActions() {
        couponBody.addEventListener("click", async event => {
            const editButton = event.target.closest("[data-edit-coupon]");
            const toggleButton = event.target.closest("[data-toggle-coupon]");
            const deleteButton = event.target.closest("[data-delete-coupon]");
            if (editButton) {
                editCoupon(editButton.dataset.editCoupon);
                return;
            }
            const code = toggleButton
                ? toggleButton.dataset.toggleCoupon
                : deleteButton
                    ? deleteButton.dataset.deleteCoupon
                    : null;
            if (!code) return;
            const coupon = coupons.find(item => item.code === code);
            if (!coupon) return;
            const button = toggleButton || deleteButton;
            button.disabled = true;
            try {
                let query;
                if (toggleButton) {
                    query = getClient().from("store_coupons")
                        .update({ active: !coupon.active })
                        .eq("code", code);
                } else {
                    if (!window.confirm(`Excluir o cupom ${code}?`)) {
                        button.disabled = false;
                        return;
                    }
                    query = getClient().from("store_coupons").delete().eq("code", code);
                }
                const { error } = await query;
                if (error) throw error;
                if (editingCode === code) resetCouponForm();
                await loadCoupons();
                showNotice(toggleButton
                    ? `Cupom ${coupon.active ? "desativado" : "ativado"}.`
                    : "Cupom excluído.");
            } catch (error) {
                console.error("Erro ao atualizar cupom:", error);
                showNotice(`Não foi possível atualizar o cupom. ${error.message || "Tente novamente."}`, "error");
                button.disabled = false;
            }
        });
    }

    async function loadProfilePhoto() {
        const { data, error } = await getClient()
            .from("store_settings")
            .select("profile_image_path")
            .eq("singleton", true)
            .single();
        if (error) throw error;
        profilePath = data.profile_image_path || "";
        renderProfilePhoto();
    }

    function renderProfilePhoto(localUrl = "") {
        if (localUrl) {
            profilePreview.src = localUrl;
            profilePreview.hidden = false;
            profileEmpty.hidden = true;
            profileRemove.hidden = !profilePath;
            return;
        }
        if (profilePath) {
            const { data } = getClient().storage.from(PROFILE_BUCKET).getPublicUrl(profilePath);
            profilePreview.src = data.publicUrl;
            profilePreview.hidden = false;
            profileEmpty.hidden = true;
            profileRemove.hidden = false;
        } else {
            profilePreview.removeAttribute("src");
            profilePreview.hidden = true;
            profileEmpty.hidden = false;
            profileRemove.hidden = true;
        }
    }

    function validateProfileFile(file) {
        if (!ALLOWED_PROFILE_TYPES.has(file.type)) {
            throw new Error("Use uma imagem JPG, PNG ou WebP.");
        }
        if (file.size > MAX_IMAGE_SIZE) {
            throw new Error("A imagem deve ter no máximo 5 MB.");
        }
    }

    profileFile.addEventListener("change", () => {
        const file = profileFile.files && profileFile.files[0];
        if (!file) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            renderProfilePhoto();
            return;
        }
        try {
            validateProfileFile(file);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = URL.createObjectURL(file);
            renderProfilePhoto(previewUrl);
        } catch (error) {
            showNotice(error.message, "error");
            profileFile.value = "";
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            renderProfilePhoto();
        }
    });

    profileForm.addEventListener("submit", async event => {
        event.preventDefault();
        const file = profileFile.files && profileFile.files[0];
        if (!file) {
            showNotice("Escolha uma imagem antes de salvar.", "error");
            return;
        }
        const button = profileForm.querySelector('[type="submit"]');
        button.disabled = true;
        let uploadedPath = "";
        const previousPath = profilePath;
        try {
            validateProfileFile(file);
            const extensionByType = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
            uploadedPath = `profile-${crypto.randomUUID()}.${extensionByType[file.type]}`;
            const { error: uploadError } = await getClient().storage
                .from(PROFILE_BUCKET)
                .upload(uploadedPath, file, {
                    contentType: file.type,
                    cacheControl: "3600",
                    upsert: false
                });
            if (uploadError) throw uploadError;

            const { error: settingsError } = await getClient()
                .from("store_settings")
                .update({ profile_image_path: uploadedPath, updated_at: new Date().toISOString() })
                .eq("singleton", true);
            if (settingsError) throw settingsError;

            profilePath = uploadedPath;
            profileForm.reset();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            renderProfilePhoto();
            if (previousPath) {
                const { error: removeError } = await getClient().storage.from(PROFILE_BUCKET).remove([previousPath]);
                if (removeError) {
                    console.error("A foto foi atualizada, mas a anterior não foi removida:", removeError);
                    showNotice("Foto atualizada, mas não foi possível limpar o arquivo anterior.", "error");
                    return;
                }
            }
            showNotice("Foto de perfil salva. Ela ainda não é exibida na loja.");
        } catch (error) {
            if (uploadedPath) {
                const { error: cleanupError } = await getClient().storage.from(PROFILE_BUCKET).remove([uploadedPath]);
                if (cleanupError) console.error("Erro ao limpar o upload após falha:", cleanupError);
            }
            console.error("Erro ao salvar foto de perfil:", error);
            showNotice(`Não foi possível salvar a foto. ${error.message || "Tente novamente."}`, "error");
        } finally {
            button.disabled = false;
        }
    });

    profileRemove.addEventListener("click", async () => {
        if (!profilePath || !window.confirm("Remover a foto de perfil salva?")) return;
        profileRemove.disabled = true;
        const oldPath = profilePath;
        try {
            const { error: settingsError } = await getClient()
                .from("store_settings")
                .update({ profile_image_path: "", updated_at: new Date().toISOString() })
                .eq("singleton", true);
            if (settingsError) throw settingsError;
            profilePath = "";
            profileForm.reset();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = "";
            renderProfilePhoto();
            const { error: removeError } = await getClient().storage.from(PROFILE_BUCKET).remove([oldPath]);
            if (removeError) {
                console.error("A foto foi removida das configurações, mas o arquivo não foi limpo:", removeError);
                showNotice("Foto removida das configurações, mas não foi possível limpar o arquivo.", "error");
                return;
            }
            showNotice("Foto de perfil removida.");
        } catch (error) {
            console.error("Erro ao remover foto de perfil:", error);
            showNotice(`Não foi possível remover a foto. ${error.message || "Tente novamente."}`, "error");
        } finally {
            profileRemove.disabled = false;
        }
    });

    promotionBody.addEventListener("click", event => {
        const saveButton = event.target.closest("[data-save-promotion]");
        const clearButton = event.target.closest("[data-clear-promotion]");
        const button = saveButton || clearButton;
        if (!button) return;
        const row = button.closest("[data-promotion-row]");
        savePromotion(row, button.dataset[saveButton ? "savePromotion" : "clearPromotion"], Boolean(clearButton));
    });

    async function initialize() {
        if (!await window.barberflowAdminReady) return;
        initCouponForm();
        initCouponActions();
        try {
            await Promise.all([loadCoupons(), loadProducts(), loadProfilePhoto()]);
        } catch (error) {
            console.error("Erro ao carregar as configurações:", error);
            showNotice(`Não foi possível carregar as configurações. ${error.message || "Tente novamente."}`, "error");
        }

        getClient().channel("admin-store-settings")
            .on("postgres_changes", { event: "*", schema: "public", table: "store_coupons" }, async () => {
                try {
                    await loadCoupons();
                } catch (error) {
                    console.error("Erro ao sincronizar cupons:", error);
                    showNotice(`Não foi possível atualizar os cupons. ${error.message || "Tente novamente."}`, "error");
                }
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
                try {
                    await loadProducts();
                } catch (error) {
                    console.error("Erro ao sincronizar promoções:", error);
                    showNotice(`Não foi possível atualizar os produtos. ${error.message || "Tente novamente."}`, "error");
                }
            })
            .subscribe();
    }

    initialize().catch(error => {
        console.error("Falha ao iniciar a configuração:", error);
        showNotice(`Não foi possível abrir as configurações. ${error.message || "Tente novamente."}`, "error");
    });
})();
