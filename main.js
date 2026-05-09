(() => {
  "use strict";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const navEntries = typeof performance.getEntriesByType === "function"
    ? performance.getEntriesByType("navigation")
    : [];
  const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
  if (isReload) {
    window.scrollTo(0, 0);
  }

  const navbar = document.getElementById("navbar");
  const headmarkCanvas = document.querySelector(".nav-headmark-canvas");
  const headmarkCtx = headmarkCanvas ? headmarkCanvas.getContext("2d", { willReadFrequently: true }) : null;
  const navbarLogo = document.querySelector(".navbar .logo-img");
  const navLinks = document.querySelector(".nav-links");
  const navPill = navLinks ? navLinks.querySelector(".nav-pill") : null;
  const navItems = navLinks ? Array.from(navLinks.querySelectorAll("a")) : [];
  const revealElements = document.querySelectorAll(".reveal");
  const heroStage = document.getElementById("hero-stage");
  const contactForm = document.querySelector(".contact-form");
  const shareLinks = document.querySelectorAll("[data-share-network]");
  const lockedVideos = document.querySelectorAll("[data-locked-video]");
  const revealPlaybackVideos = document.querySelectorAll("[data-play-after-reveal]");

  const TOP_THRESHOLD = 4;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const REL_NOOPENER = "noopener";
  const REL_NOREFERRER = "noreferrer";
  const BRAND_PURPLE_FALLBACK = { r: 93, g: 48, b: 133 };
  const HEADMARK_SIZE = 34;
  const topOnlyNavPill = document.body.classList.contains("legal-page");

  let isAtTop = window.scrollY <= TOP_THRESHOLD;
  let lastScrollY = window.scrollY;
  let scrollDirection = "down";
  let isLayoutFrameQueued = false;
  let isResizeFrameQueued = false;

  const parseHexToRgb = (rawHex) => {
    const hex = String(rawHex ?? "").trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  };

  const accentColor = parseHexToRgb(
    getComputedStyle(document.documentElement).getPropertyValue("--accent")
  ) ?? BRAND_PURPLE_FALLBACK;

  const paintHeadmarkPurple = () => {
    if (!headmarkCtx || !headmarkCanvas) return;

    const img = new Image();
    img.decoding = "async";
    img.src = "favicon.png";
    img.addEventListener("load", () => {
      const off = document.createElement("canvas");
      off.width = HEADMARK_SIZE;
      off.height = HEADMARK_SIZE;
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.clearRect(0, 0, HEADMARK_SIZE, HEADMARK_SIZE);
      offCtx.drawImage(img, 0, 0, HEADMARK_SIZE, HEADMARK_SIZE);

      const data = offCtx.getImageData(0, 0, HEADMARK_SIZE, HEADMARK_SIZE);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 8) continue;
        px[i] = accentColor.r;
        px[i + 1] = accentColor.g;
        px[i + 2] = accentColor.b;
      }
      headmarkCtx.putImageData(data, 0, 0);
    }, { once: true });
  };

  const clearNavPill = () => {
    if (!navLinks) return;
    navLinks.classList.remove("is-flow");
    navItems.forEach((item) => item.classList.remove("is-pill-active"));

    if (topOnlyNavPill && navPill) {
      navPill.style.width = "0";
      navPill.style.height = "0";
      navPill.style.opacity = "0";
    }
  };

  const setNavbarState = () => {
    if (!navbar) return;

    isAtTop = window.scrollY <= TOP_THRESHOLD;
    navbar.classList.toggle("scrolled", !isAtTop);

    if (navbarLogo) {
      const targetLogo = isAtTop ? "logo.png" : "logo-purple.png";
      if (!navbarLogo.getAttribute("src")?.endsWith(targetLogo)) {
        navbarLogo.setAttribute("src", targetLogo);
      }
    }

    if (!isAtTop) clearNavPill();
  };

  const setActiveNavPill = (link, instant = false) => {
    if (!navLinks || !navPill || !link) return;

    const navRect = navLinks.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const x = linkRect.left - navRect.left;
    const y = linkRect.top - navRect.top;

    if (instant) {
      const prevTransition = navPill.style.transition;
      navPill.style.transition = "none";
      navPill.style.width = `${linkRect.width}px`;
      navPill.style.height = `${linkRect.height}px`;
      navPill.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      navPill.getBoundingClientRect();
      navPill.style.transition = prevTransition;
    } else {
      navPill.style.width = `${linkRect.width}px`;
      navPill.style.height = `${linkRect.height}px`;
      navPill.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    if (topOnlyNavPill) {
      navPill.style.opacity = isAtTop ? "1" : "0";
    }

    navLinks.classList.add("is-flow");
    navItems.forEach((item) => {
      item.classList.toggle("is-pill-active", item === link);
    });
  };

  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  const updateHeroScrollState = () => {
    if (!heroStage) return;
    const rect = heroStage.getBoundingClientRect();
    const total = Math.max(1, rect.height - window.innerHeight);
    const traveled = clamp01(-rect.top / total);
    const textAlpha = clamp01((traveled - 0.06) / 0.52);
    const videoAlpha = 1 - clamp01((traveled - 0.2) / 0.65);
    heroStage.style.setProperty("--hero-text-alpha", textAlpha.toFixed(3));
    heroStage.style.setProperty("--hero-video-alpha", videoAlpha.toFixed(3));
  };

  const runLayoutUpdate = () => {
    isLayoutFrameQueued = false;
    setNavbarState();
    updateHeroScrollState();
  };

  const queueLayoutUpdate = () => {
    if (isLayoutFrameQueued) return;
    isLayoutFrameQueued = true;
    window.requestAnimationFrame(runLayoutUpdate);
  };

  const showWithoutFade = (element) => {
    element.classList.add("no-transition");
    element.classList.add("is-visible");
    window.requestAnimationFrame(() => {
      element.classList.remove("no-transition");
    });
  };

  const playRevealVideos = (element) => {
    const videos = element.querySelectorAll("[data-play-after-reveal]");
    if (videos.length === 0) return;

    videos.forEach((video) => {
      video.dataset.revealReady = "true";
      video.play().catch(() => {});
    });
  };

  const playRevealVideosAfterTransition = (element) => {
    const videos = element.querySelectorAll("[data-play-after-reveal]");
    if (videos.length === 0 || element.dataset.revealPlaybackStarted === "true") return;

    element.dataset.revealPlaybackStarted = "true";

    if (element.classList.contains("no-transition")) {
      playRevealVideos(element);
      return;
    }

    const startPlayback = () => playRevealVideos(element);
    const fallbackId = window.setTimeout(startPlayback, 900);

    const handleTransitionEnd = (event) => {
      if (event.target !== element || event.propertyName !== "opacity") return;
      window.clearTimeout(fallbackId);
      element.removeEventListener("transitionend", handleTransitionEnd);
      startPlayback();
    };

    element.addEventListener("transitionend", handleTransitionEnd);
  };

  const sanitizeForMailto = (value, maxLength) => {
    const normalized = String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
      .trim();
    return typeof maxLength === "number" ? normalized.slice(0, maxLength) : normalized;
  };

  const hardenBlankTargetLinks = () => {
    const externalLinks = document.querySelectorAll('a[target="_blank"]');
    if (externalLinks.length === 0) return;

    externalLinks.forEach((link) => {
      const currentRel = (link.getAttribute("rel") || "")
        .split(/\s+/)
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean);
      const relSet = new Set(currentRel);
      relSet.add(REL_NOOPENER);
      relSet.add(REL_NOREFERRER);
      link.setAttribute("rel", Array.from(relSet).join(" "));
    });
  };

  const hydrateShareLinks = () => {
    if (shareLinks.length === 0) return;

    const articleUrl = encodeURIComponent(window.location.href);
    const articleTitle = encodeURIComponent(document.title.replace(/\s*\|\s*SmartBook AI\s*$/, ""));

    shareLinks.forEach((link) => {
      const network = link.getAttribute("data-share-network");
      if (network === "facebook") {
        link.href = `https://www.facebook.com/sharer/sharer.php?u=${articleUrl}`;
      }
      if (network === "x") {
        link.href = `https://twitter.com/intent/tweet?url=${articleUrl}&text=${articleTitle}`;
      }
    });
  };

  const lockVideos = () => {
    if (lockedVideos.length === 0) return;

    lockedVideos.forEach((video) => {
      video.controls = false;
      video.removeAttribute("controls");
      video.setAttribute("disablepictureinpicture", "");
      video.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");

      video.addEventListener("contextmenu", (event) => event.preventDefault());
      video.addEventListener("pause", () => {
        if (video.ended) return;
        if (video.matches("[data-play-after-reveal]") && video.dataset.revealReady !== "true") return;
        video.play().catch(() => {});
      });
    });
  };

  const prepareRevealPlaybackVideos = () => {
    if (revealPlaybackVideos.length === 0) return;

    revealPlaybackVideos.forEach((video) => {
      video.dataset.revealReady = "false";
      video.removeAttribute("autoplay");
      video.pause();
    });
  };

  navItems.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      if (topOnlyNavPill && !isAtTop) return;
      setActiveNavPill(item);
    });
    item.addEventListener("focus", () => {
      if (topOnlyNavPill && !isAtTop) return;
      setActiveNavPill(item);
    });
  });

  if (navLinks) {
    navLinks.addEventListener("mouseleave", clearNavPill);
    navLinks.addEventListener("focusout", (event) => {
      if (!navLinks.contains(event.relatedTarget)) clearNavPill();
    });
  }

  prepareRevealPlaybackVideos();

  if (revealElements.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const alreadyShown = entry.target.classList.contains("has-appeared");
            if (scrollDirection === "down" && !alreadyShown) {
              entry.target.classList.add("is-visible");
              playRevealVideosAfterTransition(entry.target);
            } else {
              showWithoutFade(entry.target);
              playRevealVideos(entry.target);
            }
            entry.target.classList.add("has-appeared");
          } else if (!entry.target.classList.contains("has-appeared")) {
            entry.target.classList.remove("is-visible");
            entry.target.classList.remove("no-transition");
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );

    revealElements.forEach((el, index) => {
      el.style.setProperty("--reveal-delay", `${Math.min(index * 60, 300)}ms`);
      observer.observe(el);
    });
  } else if (revealElements.length > 0) {
    revealElements.forEach((el) => {
      el.classList.add("is-visible");
      playRevealVideos(el);
    });
  }

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      if (contactForm.action.startsWith("https://formsubmit.co/")) return;

      event.preventDefault();
      const formData = new FormData(contactForm);
      const name = sanitizeForMailto(formData.get("Nombre"), 120);
      const email = sanitizeForMailto(formData.get("Email") || formData.get("email"), 160);
      const company = sanitizeForMailto(formData.get("Empresa"), 120);
      const message = sanitizeForMailto(formData.get("Mensaje"), 2000);
      if (!name || !email || !message || !EMAIL_REGEX.test(email)) {
        contactForm.reportValidity();
        return;
      }
      const subject = encodeURIComponent(`Consulta web SmartBook AI - ${name || "Nuevo contacto"}`);
      const body = encodeURIComponent(
        `Nombre: ${name}\nEmail: ${email}\nEmpresa: ${company || "-"}\n\nMensaje:\n${message}`
      );
      window.location.href = `mailto:info@smartbook-ai.com?subject=${subject}&body=${body}`;
    });
  }

  window.addEventListener(
    "scroll",
    () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY) scrollDirection = "down";
      if (currentY < lastScrollY) scrollDirection = "up";
      lastScrollY = currentY;
      queueLayoutUpdate();
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      if (isResizeFrameQueued) return;
      isResizeFrameQueued = true;
      window.requestAnimationFrame(() => {
        isResizeFrameQueued = false;
        const active = navLinks?.querySelector("a.is-pill-active");
        if (active) {
          setActiveNavPill(active, true);
        } else if (topOnlyNavPill) {
          clearNavPill();
        }
        queueLayoutUpdate();
      });
    },
    { passive: true }
  );

  setNavbarState();
  paintHeadmarkPurple();
  updateHeroScrollState();
  hydrateShareLinks();
  lockVideos();
  hardenBlankTargetLinks();

  const loginForm = document.getElementById("form-login");
  if (loginForm) {
    const loginErrorEl  = document.getElementById("login-error");
    const loginBanner   = document.getElementById("login-banner");
    const btnSubmit     = document.getElementById("btn-login-submit");
    const btnLabel      = document.getElementById("btn-login-label");
    const btnEye        = document.getElementById("btn-eye");
    const pwInput       = document.getElementById("login-password");

    if (loginBanner && new URLSearchParams(window.location.search).get("registro") === "ok") {
      loginBanner.style.display = "block";
    }

    if (btnEye && pwInput) {
      btnEye.addEventListener("click", () => {
        const showing = pwInput.type === "text";
        pwInput.type = showing ? "password" : "text";
        btnEye.setAttribute("aria-label", showing ? "Mostrar contraseña" : "Ocultar contraseña");
        const iconEl = document.getElementById("icon-eye");
        if (iconEl) {
          iconEl.innerHTML = showing
            ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
            : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        }
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginErrorEl) { loginErrorEl.style.display = "none"; loginErrorEl.textContent = ""; }
      if (btnSubmit) { btnSubmit.disabled = true; }
      if (btnLabel)  { btnLabel.textContent = "Accediendo…"; }

      const email    = document.getElementById("login-email")?.value || "";
      const password = pwInput?.value || "";

      try {
        const res = await fetch("http://localhost:8080/api/login/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = data.error || data.detail || "Credenciales incorrectas. Inténtalo de nuevo.";
          if (loginErrorEl) { loginErrorEl.textContent = msg; loginErrorEl.style.display = "block"; }
          if (btnSubmit) btnSubmit.disabled = false;
          if (btnLabel)  btnLabel.textContent = "Iniciar sesión";
          return;
        }

        window.location.href = data.redirect || "/dashboard/";
      } catch {
        if (loginErrorEl) {
          loginErrorEl.textContent = "No se pudo conectar con el servidor. Comprueba tu conexión.";
          loginErrorEl.style.display = "block";
        }
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnLabel)  btnLabel.textContent = "Iniciar sesión";
      }
    });
  }

  const registroForm = document.getElementById("form-registro");
  if (registroForm) {
    const errorEl = document.getElementById("registro-error");

    const mostrarError = (msg) => {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    };

    const ocultarError = () => {
      if (!errorEl) return;
      errorEl.style.display = "none";
      errorEl.textContent = "";
    };

    registroForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      ocultarError();

      const btn = registroForm.querySelector(".auth-submit");
      btn.textContent = "Procesando…";
      btn.disabled = true;

      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        nombre: document.getElementById("name").value,
        telefono: document.getElementById("phone").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        plan: urlParams.get("plan") || "sin_plan",
      };

      try {
        const res = await fetch("http://localhost:8080/api/register/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg =
            data.email?.[0] ||
            data.detail ||
            data.error ||
            Object.values(data)[0]?.[0] ||
            "Ha ocurrido un error. Por favor, inténtalo de nuevo.";
          mostrarError(msg);
          btn.textContent = "Registrarme gratis";
          btn.disabled = false;
          return;
        }

        window.location.href = `confirm.html?email=${encodeURIComponent(payload.email)}`;
      } catch (err) {
        console.error("[registro]", err);
        mostrarError("No hemos podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.");
        btn.textContent = "Registrarme gratis";
        btn.disabled = false;
      }
    });
  }

  const confirmEmailEl = document.getElementById("confirm-email");
  if (confirmEmailEl) {
    const email = new URLSearchParams(window.location.search).get("email");
    if (email) confirmEmailEl.textContent = email;
  }

  const btnResend = document.getElementById("btn-resend");
  if (btnResend) {
    const COOLDOWN_MS = 3 * 60 * 1000;
    const STORAGE_KEY = "resend_unlock_at";
    const labelEl = document.getElementById("btn-resend-label");
    const feedbackEl = document.getElementById("resend-feedback");
    const email = new URLSearchParams(window.location.search).get("email") || "";

    let countdownInterval = null;

    const setFeedback = (msg, type) => {
      if (!feedbackEl) return;
      feedbackEl.textContent = msg;
      feedbackEl.className = `resend-feedback${type ? ` ${type}` : ""}`;
    };

    const startCountdown = (unlockAt) => {
      if (countdownInterval) clearInterval(countdownInterval);
      btnResend.disabled = true;

      const tick = () => {
        const remaining = Math.max(0, unlockAt - Date.now());
        if (remaining === 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          btnResend.disabled = false;
          if (labelEl) labelEl.textContent = "Reenviar correo";
          return;
        }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        if (labelEl) labelEl.textContent = `Reenviar en ${mins}:${String(secs).padStart(2, "0")}`;
      };

      tick();
      countdownInterval = setInterval(tick, 1000);
    };

    const savedUnlockAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
    if (savedUnlockAt > Date.now()) {
      startCountdown(savedUnlockAt);
    }

    btnResend.addEventListener("click", async () => {
      if (btnResend.disabled) return;
      if (!email) {
        setFeedback("No se pudo identificar tu correo. Vuelve a la página de registro.", "err");
        return;
      }

      btnResend.disabled = true;
      if (labelEl) labelEl.textContent = "Enviando…";
      setFeedback("", "");

      try {
        const res = await fetch("http://localhost:8080/api/resend-confirmation/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (res.status === 410) {
          setFeedback("El registro ha expirado. Por favor, regístrate de nuevo.", "err");
          btnResend.disabled = false;
          if (labelEl) labelEl.textContent = "Reenviar correo";
          return;
        }

        if (!res.ok && res.status !== 429) {
          const data = await res.json().catch(() => ({}));
          setFeedback(data.error || "No se pudo reenviar el correo. Inténtalo más tarde.", "err");
          btnResend.disabled = false;
          if (labelEl) labelEl.textContent = "Reenviar correo";
          return;
        }

        const unlockAt = Date.now() + COOLDOWN_MS;
        localStorage.setItem(STORAGE_KEY, String(unlockAt));
        setFeedback("Correo reenviado. Revisa tu bandeja de entrada.", "ok");
        startCountdown(unlockAt);
      } catch {
        setFeedback("No se pudo conectar con el servidor. Comprueba tu conexión.", "err");
        btnResend.disabled = false;
        if (labelEl) labelEl.textContent = "Reenviar correo";
      }
    });
  }
})();
