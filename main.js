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

  const API_BASE_URL = "http://127.0.0.1:8080";
  const TOP_THRESHOLD = 4;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^[0-9+\s-]+$/;
  const PASSWORD_MIN_LENGTH = 8;
  const PASSWORD_MAX_LENGTH = 256;
  const DEFAULT_REDIRECT = "/dashboard/";
  const DEFAULT_PLAN = "sin_plan";
  const ALLOWED_PLAN_VALUES = new Set(["starter", "lite", "smart", "power", "ultra", DEFAULT_PLAN]);
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

  const apiUrl = (path) => `${API_BASE_URL}${path}`;

  const normalizeText = (value) => String(value ?? "").trim();

  const normalizeEmail = (value) => normalizeText(value).toLowerCase();

  const isValidEmail = (value) => EMAIL_REGEX.test(normalizeEmail(value));

  const isValidPassword = (value) => {
    const password = String(value ?? "");
    return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
  };

  const isValidPhone = (value) => {
    const phone = normalizeText(value);
    return phone.length > 0 && phone.length <= 30 && PHONE_REGEX.test(phone);
  };

  const normalizePlan = (value) => {
    const plan = normalizeText(value || DEFAULT_PLAN).toLowerCase();
    return ALLOWED_PLAN_VALUES.has(plan) ? plan : DEFAULT_PLAN;
  };

  const safeInternalRedirect = (redirect) => {
    if (typeof redirect !== "string" || redirect.trim() === "") return DEFAULT_REDIRECT;

    try {
      const url = new URL(redirect, window.location.origin);
      if (url.origin !== window.location.origin) return DEFAULT_REDIRECT;
      if (!url.pathname.startsWith("/")) return DEFAULT_REDIRECT;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return DEFAULT_REDIRECT;
    }
  };

  const setSvgIcon = (svg, elements) => {
    if (!svg) return;
    svg.replaceChildren();
    elements.forEach(({ tag, attrs }) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
      svg.appendChild(node);
    });
  };

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

  const CONTACT_PHONE_COUNTRIES = [
    ["🇦🇫", "Afganistan", "+93"],
    ["🇦🇱", "Albania", "+355"],
    ["🇩🇪", "Alemania", "+49"],
    ["🇦🇩", "Andorra", "+376"],
    ["🇦🇴", "Angola", "+244"],
    ["🇦🇬", "Antigua y Barbuda", "+1-268"],
    ["🇸🇦", "Arabia Saudita", "+966"],
    ["🇩🇿", "Argelia", "+213"],
    ["🇦🇷", "Argentina", "+54"],
    ["🇦🇲", "Armenia", "+374"],
    ["🇦🇺", "Australia", "+61"],
    ["🇦🇹", "Austria", "+43"],
    ["🇦🇿", "Azerbaiyan", "+994"],
    ["🇧🇸", "Bahamas", "+1-242"],
    ["🇧🇭", "Barein", "+973"],
    ["🇧🇩", "Banglades", "+880"],
    ["🇧🇧", "Barbados", "+1-246"],
    ["🇧🇪", "Belgica", "+32"],
    ["🇧🇿", "Belice", "+501"],
    ["🇧🇯", "Benin", "+229"],
    ["🇧🇾", "Bielorrusia", "+375"],
    ["🇧🇴", "Bolivia", "+591"],
    ["🇧🇦", "Bosnia y Herzegovina", "+387"],
    ["🇧🇼", "Botsuana", "+267"],
    ["🇧🇷", "Brasil", "+55"],
    ["🇧🇳", "Brunei", "+673"],
    ["🇧🇬", "Bulgaria", "+359"],
    ["🇧🇫", "Burkina Faso", "+226"],
    ["🇧🇮", "Burundi", "+257"],
    ["🇧🇹", "Butan", "+975"],
    ["🇨🇻", "Cabo Verde", "+238"],
    ["🇰🇭", "Camboya", "+855"],
    ["🇨🇲", "Camerun", "+237"],
    ["🇨🇦", "Canada", "+1"],
    ["🇶🇦", "Catar", "+974"],
    ["🇹🇩", "Chad", "+235"],
    ["🇨🇱", "Chile", "+56"],
    ["🇨🇳", "China", "+86"],
    ["🇨🇾", "Chipre", "+357"],
    ["🇨🇴", "Colombia", "+57"],
    ["🇰🇲", "Comoras", "+269"],
    ["🇰🇵", "Corea del Norte", "+850"],
    ["🇰🇷", "Corea del Sur", "+82"],
    ["🇨🇮", "Costa de Marfil", "+225"],
    ["🇨🇷", "Costa Rica", "+506"],
    ["🇭🇷", "Croacia", "+385"],
    ["🇨🇺", "Cuba", "+53"],
    ["🇩🇰", "Dinamarca", "+45"],
    ["🇩🇲", "Dominica", "+1-767"],
    ["🇪🇨", "Ecuador", "+593"],
    ["🇪🇬", "Egipto", "+20"],
    ["🇸🇻", "El Salvador", "+503"],
    ["🇦🇪", "Emiratos Arabes Unidos", "+971"],
    ["🇪🇷", "Eritrea", "+291"],
    ["🇸🇰", "Eslovaquia", "+421"],
    ["🇸🇮", "Eslovenia", "+386"],
    ["🇪🇸", "España", "+34"],
    ["🇺🇸", "Estados Unidos", "+1"],
    ["🇪🇪", "Estonia", "+372"],
    ["🇸🇿", "Esuatini", "+268"],
    ["🇪🇹", "Etiopia", "+251"],
    ["🇵🇭", "Filipinas", "+63"],
    ["🇫🇮", "Finlandia", "+358"],
    ["🇫🇯", "Fiyi", "+679"],
    ["🇫🇷", "Francia", "+33"],
    ["🇬🇦", "Gabon", "+241"],
    ["🇬🇲", "Gambia", "+220"],
    ["🇬🇪", "Georgia", "+995"],
    ["🇬🇭", "Ghana", "+233"],
    ["🇬🇩", "Granada", "+1-473"],
    ["🇬🇷", "Grecia", "+30"],
    ["🇬🇹", "Guatemala", "+502"],
    ["🇬🇳", "Guinea", "+224"],
    ["🇬🇶", "Guinea Ecuatorial", "+240"],
    ["🇬🇼", "Guinea-Bisau", "+245"],
    ["🇬🇾", "Guyana", "+592"],
    ["🇭🇹", "Haiti", "+509"],
    ["🇭🇳", "Honduras", "+504"],
    ["🇭🇺", "Hungria", "+36"],
    ["🇮🇳", "India", "+91"],
    ["🇮🇩", "Indonesia", "+62"],
    ["🇮🇶", "Irak", "+964"],
    ["🇮🇷", "Iran", "+98"],
    ["🇮🇪", "Irlanda", "+353"],
    ["🇮🇸", "Islandia", "+354"],
    ["🇲🇭", "Islas Marshall", "+692"],
    ["🇸🇧", "Islas Salomon", "+677"],
    ["🇮🇱", "Israel", "+972"],
    ["🇮🇹", "Italia", "+39"],
    ["🇯🇲", "Jamaica", "+1-876"],
    ["🇯🇵", "Japon", "+81"],
    ["🇯🇴", "Jordania", "+962"],
    ["🇰🇿", "Kazajistan", "+7"],
    ["🇰🇪", "Kenia", "+254"],
    ["🇰🇬", "Kirguistan", "+996"],
    ["🇰🇮", "Kiribati", "+686"],
    ["🇽🇰", "Kosovo", "+383"],
    ["🇰🇼", "Kuwait", "+965"],
    ["🇱🇦", "Laos", "+856"],
    ["🇱🇸", "Lesoto", "+266"],
    ["🇱🇻", "Letonia", "+371"],
    ["🇱🇧", "Libano", "+961"],
    ["🇱🇷", "Liberia", "+231"],
    ["🇱🇾", "Libia", "+218"],
    ["🇱🇮", "Liechtenstein", "+423"],
    ["🇱🇹", "Lituania", "+370"],
    ["🇱🇺", "Luxemburgo", "+352"],
    ["🇲🇰", "Macedonia del Norte", "+389"],
    ["🇲🇬", "Madagascar", "+261"],
    ["🇲🇾", "Malasia", "+60"],
    ["🇲🇼", "Malaui", "+265"],
    ["🇲🇻", "Maldivas", "+960"],
    ["🇲🇱", "Mali", "+223"],
    ["🇲🇹", "Malta", "+356"],
    ["🇲🇦", "Marruecos", "+212"],
    ["🇲🇺", "Mauricio", "+230"],
    ["🇲🇷", "Mauritania", "+222"],
    ["🇲🇽", "Mexico", "+52"],
    ["🇫🇲", "Micronesia", "+691"],
    ["🇲🇩", "Moldavia", "+373"],
    ["🇲🇨", "Monaco", "+377"],
    ["🇲🇳", "Mongolia", "+976"],
    ["🇲🇪", "Montenegro", "+382"],
    ["🇲🇿", "Mozambique", "+258"],
    ["🇲🇲", "Myanmar", "+95"],
    ["🇳🇦", "Namibia", "+264"],
    ["🇳🇷", "Nauru", "+674"],
    ["🇳🇵", "Nepal", "+977"],
    ["🇳🇮", "Nicaragua", "+505"],
    ["🇳🇪", "Niger", "+227"],
    ["🇳🇬", "Nigeria", "+234"],
    ["🇳🇴", "Noruega", "+47"],
    ["🇳🇿", "Nueva Zelanda", "+64"],
    ["🇴🇲", "Oman", "+968"],
    ["🇳🇱", "Paises Bajos", "+31"],
    ["🇵🇰", "Pakistan", "+92"],
    ["🇵🇼", "Palaos", "+680"],
    ["🇵🇸", "Palestina", "+970"],
    ["🇵🇦", "Panama", "+507"],
    ["🇵🇬", "Papua Nueva Guinea", "+675"],
    ["🇵🇾", "Paraguay", "+595"],
    ["🇵🇪", "Peru", "+51"],
    ["🇵🇱", "Polonia", "+48"],
    ["🇵🇹", "Portugal", "+351"],
    ["🇬🇧", "Reino Unido", "+44"],
    ["🇨🇫", "Republica Centroafricana", "+236"],
    ["🇨🇿", "Republica Checa", "+420"],
    ["🇨🇬", "Republica del Congo", "+242"],
    ["🇨🇩", "Republica Democratica del Congo", "+243"],
    ["🇩🇴", "Republica Dominicana", "+1-809"],
    ["🇷🇼", "Ruanda", "+250"],
    ["🇷🇴", "Rumania", "+40"],
    ["🇷🇺", "Rusia", "+7"],
    ["🇼🇸", "Samoa", "+685"],
    ["🇰🇳", "San Cristobal y Nieves", "+1-869"],
    ["🇸🇲", "San Marino", "+378"],
    ["🇻🇨", "San Vicente y las Granadinas", "+1-784"],
    ["🇱🇨", "Santa Lucia", "+1-758"],
    ["🇸🇹", "Santo Tome y Principe", "+239"],
    ["🇸🇳", "Senegal", "+221"],
    ["🇷🇸", "Serbia", "+381"],
    ["🇸🇨", "Seychelles", "+248"],
    ["🇸🇱", "Sierra Leona", "+232"],
    ["🇸🇬", "Singapur", "+65"],
    ["🇸🇾", "Siria", "+963"],
    ["🇸🇴", "Somalia", "+252"],
    ["🇱🇰", "Sri Lanka", "+94"],
    ["🇿🇦", "Sudafrica", "+27"],
    ["🇸🇩", "Sudan", "+249"],
    ["🇸🇸", "Sudan del Sur", "+211"],
    ["🇸🇪", "Suecia", "+46"],
    ["🇨🇭", "Suiza", "+41"],
    ["🇸🇷", "Surinam", "+597"],
    ["🇹🇭", "Tailandia", "+66"],
    ["🇹🇼", "Taiwan", "+886"],
    ["🇹🇿", "Tanzania", "+255"],
    ["🇹🇯", "Tayikistan", "+992"],
    ["🇹🇱", "Timor Oriental", "+670"],
    ["🇹🇬", "Togo", "+228"],
    ["🇹🇴", "Tonga", "+676"],
    ["🇹🇹", "Trinidad y Tobago", "+1-868"],
    ["🇹🇳", "Tunez", "+216"],
    ["🇹🇲", "Turkmenistan", "+993"],
    ["🇹🇷", "Turquia", "+90"],
    ["🇹🇻", "Tuvalu", "+688"],
    ["🇺🇦", "Ucrania", "+380"],
    ["🇺🇬", "Uganda", "+256"],
    ["🇺🇾", "Uruguay", "+598"],
    ["🇺🇿", "Uzbekistan", "+998"],
    ["🇻🇺", "Vanuatu", "+678"],
    ["🇻🇦", "Vaticano", "+379"],
    ["🇻🇪", "Venezuela", "+58"],
    ["🇻🇳", "Vietnam", "+84"],
    ["🇾🇪", "Yemen", "+967"],
    ["🇩🇯", "Yibuti", "+253"],
    ["🇿🇲", "Zambia", "+260"],
    ["🇿🇼", "Zimbabue", "+263"],
  ].sort((a, b) => a[1].localeCompare(b[1], "es", { sensitivity: "base" }));

  const initContactPhoneField = () => {
    const phoneField = document.querySelector("[data-contact-phone]");
    if (!phoneField) return;

    const prefixButton = phoneField.querySelector(".contact-phone-prefix-button");
    const prefixFlag = phoneField.querySelector(".contact-phone-prefix-flag");
    const prefixCode = phoneField.querySelector(".contact-phone-prefix-code");
    const numberInput = phoneField.querySelector(".contact-phone-number");
    const hiddenInput = phoneField.querySelector('input[name="phone"]');
    const dropdown = phoneField.querySelector(".contact-phone-dropdown");
    if (!prefixButton || !prefixFlag || !prefixCode || !numberInput || !hiddenInput || !dropdown) return;

    let selectedCountry = CONTACT_PHONE_COUNTRIES.find((country) => country[1] === "España") || CONTACT_PHONE_COUNTRIES[0];

    const updateHiddenPhone = () => {
      const number = String(numberInput.value || "").trim();
      hiddenInput.value = number ? `${selectedCountry[2]} ${number}` : "";
    };

    const setCountry = (country) => {
      selectedCountry = country;
      prefixFlag.textContent = country[0];
      prefixCode.textContent = country[2];
      dropdown.querySelectorAll(".contact-phone-option").forEach((option) => {
        const isSelected = option.dataset.code === country[2] && option.dataset.country === country[1];
        option.classList.toggle("is-selected", isSelected);
        option.setAttribute("aria-selected", String(isSelected));
      });
      updateHiddenPhone();
    };

    const closeDropdown = () => {
      dropdown.hidden = true;
      prefixButton.setAttribute("aria-expanded", "false");
    };

    const openDropdown = () => {
      dropdown.hidden = false;
      prefixButton.setAttribute("aria-expanded", "true");
    };

    const toggleDropdown = () => {
      if (dropdown.hidden) {
        openDropdown();
      } else {
        closeDropdown();
      }
    };

    CONTACT_PHONE_COUNTRIES.forEach((country) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "contact-phone-option";
      option.setAttribute("role", "option");
      option.dataset.country = country[1];
      option.dataset.code = country[2];
      option.innerHTML = `
        <span class="contact-phone-option-flag" aria-hidden="true">${country[0]}</span>
        <span class="contact-phone-option-name">${country[1]}</span>
        <span class="contact-phone-option-code">${country[2]}</span>
      `;
      option.addEventListener("click", () => {
        setCountry(country);
        closeDropdown();
        numberInput.focus();
      });
      dropdown.appendChild(option);
    });

    prefixButton.addEventListener("click", toggleDropdown);

    numberInput.addEventListener("input", () => {
      numberInput.value = numberInput.value.replace(/[^\d\s-]/g, "");
      updateHiddenPhone();
    });

    phoneField.closest("form")?.addEventListener("submit", updateHiddenPhone);

    document.addEventListener("click", (event) => {
      if (!phoneField.contains(event.target)) closeDropdown();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDropdown();
    });

    setCountry(selectedCountry);
    closeDropdown();
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
  initContactPhoneField();

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

  const GOOGLE_CLIENT_ID = "777000793019-pi4b3ijo5jcn2l79brbv9d0f3a4lg59s.apps.googleusercontent.com";

  const GOOGLE_SESSION_KEY = "sba_google_auth";

  const handleGoogleToken = async (tokenResponse) => {
    const btnGoogle  = document.getElementById("btn-google");
    const loginError = document.getElementById("login-error");

    if (tokenResponse.error) {
      if (loginError) { loginError.textContent = "Autenticación con Google cancelada."; loginError.style.display = "block"; }
      return;
    }

    if (btnGoogle) btnGoogle.disabled = true;
    if (loginError) loginError.style.display = "none";

    let email = "", name = "";
    try {
      const uiRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });
      const ui = await uiRes.json();
      email = ui.email || "";
      name  = ui.name  || "";
    } catch { /* continúa sin datos */ }

    try {
      const res  = await fetch("http://127.0.0.1:8080/api/auth/google/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ access_token: tokenResponse.access_token }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (loginError) { loginError.textContent = data.error || "Error al iniciar sesión con Google."; loginError.style.display = "block"; }
        if (btnGoogle) btnGoogle.disabled = false;
        return;
      }

      if (data.action === "register") {
        sessionStorage.setItem(GOOGLE_SESSION_KEY, JSON.stringify({ access_token: tokenResponse.access_token, email, name }));
        window.location.href = "pricing.html";
        return;
      }

      window.location.href = data.redirect || "http://127.0.0.1:8080/";
    } catch {
      if (loginError) { loginError.textContent = "No se pudo conectar con el servidor."; loginError.style.display = "block"; }
      if (btnGoogle) btnGoogle.disabled = false;
    }
  };

  const initGoogleAuth = () => {
    if (!window.google?.accounts?.oauth2) return;

    const btnGoogle = document.getElementById("btn-google");
    if (!btnGoogle) return;

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: handleGoogleToken,
    });

    btnGoogle.addEventListener("click", () => tokenClient.requestAccessToken());
  };

  window.addEventListener("load", initGoogleAuth);

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
          setSvgIcon(iconEl, showing
            ? [
                { tag: "path", attrs: { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" } },
                { tag: "circle", attrs: { cx: "12", cy: "12", r: "3" } },
              ]
            : [
                { tag: "path", attrs: { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" } },
                { tag: "line", attrs: { x1: "1", y1: "1", x2: "23", y2: "23" } },
              ]);
        }
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginErrorEl) { loginErrorEl.style.display = "none"; loginErrorEl.textContent = ""; }
      if (btnSubmit) { btnSubmit.disabled = true; }
      if (btnLabel)  { btnLabel.textContent = "Accediendo…"; }

      const email    = normalizeEmail(document.getElementById("login-email")?.value);
      const password = pwInput?.value || "";

      if (!isValidEmail(email) || !isValidPassword(password)) {
        if (loginErrorEl) {
          loginErrorEl.textContent = "Credenciales incorrectas. Inténtalo de nuevo.";
          loginErrorEl.style.display = "block";
        }
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnLabel)  btnLabel.textContent = "Iniciar sesión";
        return;
      }

      try {
        const res = await fetch(apiUrl("/api/login/"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
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

        window.location.href = data.redirect || "http://127.0.0.1:8080/";
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

    // Detectar si viene de Google
    const googleRaw = sessionStorage.getItem(GOOGLE_SESSION_KEY);
    const googleData = googleRaw ? JSON.parse(googleRaw) : null;

    if (googleData) {
      const nameInput     = document.getElementById("name");
      const emailInput    = document.getElementById("email");
      const passwordField = document.getElementById("field-password");
      const passwordInput = document.getElementById("password");
      const banner        = document.getElementById("google-banner");
      const emailLabel    = document.getElementById("google-email-label");

      if (nameInput && googleData.name)   { nameInput.value = googleData.name; }
      if (emailInput && googleData.email) { emailInput.value = googleData.email; emailInput.readOnly = true; }
      if (passwordField) { passwordField.style.display = "none"; }
      if (passwordInput) { passwordInput.required = false; passwordInput.removeAttribute("minlength"); }
      if (banner)        { banner.style.display = "flex"; }
      if (emailLabel)    { emailLabel.textContent = googleData.email; }
    }

    registroForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      ocultarError();

      const btn = registroForm.querySelector(".auth-submit");
      btn.textContent = "Procesando…";
      btn.disabled = true;

      const urlParams = new URLSearchParams(window.location.search);
      const emailValue = document.getElementById("email").value;

      const payload = {
        nombre:   normalizeText(document.getElementById("name").value),
        telefono: normalizeText(document.getElementById("phone").value),
        email:    normalizeEmail(document.getElementById("email").value),
        plan:     normalizePlan(urlParams.get("plan")),
      };

      if (googleData) {
        payload.google_access_token = googleData.access_token;
      } else {
        payload.password = document.getElementById("password").value;
      }

      if (!payload.nombre || !isValidPhone(payload.telefono) || !isValidEmail(payload.email)) {
        mostrarError("Revisa los campos del formulario e inténtalo de nuevo.");
        btn.textContent = "Registrarme gratis";
        btn.disabled = false;
        return;
      }
      if (!googleData && !isValidPassword(payload.password)) {
        mostrarError("La contraseña debe tener al menos 8 caracteres.");
        btn.textContent = "Registrarme gratis";
        btn.disabled = false;
        return;
      }

      try {
        const res = await fetch(apiUrl("/api/register/"), {
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

        sessionStorage.removeItem(GOOGLE_SESSION_KEY);
        window.location.href = `confirm.html?email=${encodeURIComponent(emailValue)}`;
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
    const email = normalizeEmail(new URLSearchParams(window.location.search).get("email"));

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
      if (!isValidEmail(email)) {
        setFeedback("No se pudo identificar tu correo. Vuelve a la página de registro.", "err");
        return;
      }

      btnResend.disabled = true;
      if (labelEl) labelEl.textContent = "Enviando…";
      setFeedback("", "");

      try {
        const res = await fetch(apiUrl("/api/resend-confirmation/"), {
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
