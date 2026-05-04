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

  if (revealElements.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const alreadyShown = entry.target.classList.contains("has-appeared");
            if (scrollDirection === "down" && !alreadyShown) {
              entry.target.classList.add("is-visible");
            } else {
              showWithoutFade(entry.target);
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
    revealElements.forEach((el) => el.classList.add("is-visible"));
  }

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const name = sanitizeForMailto(formData.get("Nombre"), 120);
      const email = sanitizeForMailto(formData.get("Email"), 160);
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
  hardenBlankTargetLinks();
})();
