(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js-ready");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Bring sections in gently, but keep the page fully readable if observers are unavailable.
  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });
    revealItems.forEach((item, index) => {
      if (item.classList.contains("project-card")) {
        item.style.transitionDelay = (index % 3) * 55 + "ms";
      }
      revealObserver.observe(item);
    });
  } else {
    revealItems.forEach(item => item.classList.add("is-visible"));
  }

  // Project category filters; all controls announce the active state to assistive technology.
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const projectCards = Array.from(document.querySelectorAll(".project-card[data-categories]"));
  const applyFilter = filter => {
    projectCards.forEach(card => {
      const categories = (card.dataset.categories || "").split(/\s+/);
      const visible = filter === "all" || categories.includes(filter);
      card.classList.toggle("is-hidden", !visible);
      card.setAttribute("aria-hidden", String(!visible));
      card.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach(control => {
        if (visible) {
          if (control.dataset.filterTabindex !== undefined) {
            if (control.dataset.filterTabindex === "") control.removeAttribute("tabindex");
            else control.setAttribute("tabindex", control.dataset.filterTabindex);
            delete control.dataset.filterTabindex;
          } else if (control.getAttribute("tabindex") === "-1") {
            control.removeAttribute("tabindex");
          }
        } else {
          if (control.dataset.filterTabindex === undefined) {
            control.dataset.filterTabindex = control.getAttribute("tabindex") || "";
          }
          control.setAttribute("tabindex", "-1");
        }
      });
    });
    filterButtons.forEach(button => {
      const active = button.dataset.filter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  filterButtons.forEach(button => button.addEventListener("click", () => applyFilter(button.dataset.filter)));

  // Small, pointer-only depth effect. Touch and reduced-motion users get a stable layout.
  if (finePointer && !reduceMotion) {
    projectCards.forEach(card => {
      card.addEventListener("pointermove", event => {
        if (card.classList.contains("is-hidden")) return;
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        const rotateY = (x - 0.5) * 3.5;
        const rotateX = (0.5 - y) * 3.2;
        card.style.transform = "perspective(1100px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg) translateY(-2px)";
      });
      card.addEventListener("pointerleave", () => card.style.removeProperty("transform"));
    });

    const glow = document.querySelector(".cursor-glow");
    let glowFrame = 0;
    window.addEventListener("pointermove", event => {
      if (!glow) return;
      if (glowFrame) cancelAnimationFrame(glowFrame);
      glowFrame = requestAnimationFrame(() => {
        glow.style.left = event.clientX + "px";
        glow.style.top = event.clientY + "px";
        glow.style.opacity = "1";
      });
    }, { passive: true });
    document.addEventListener("pointerleave", () => { if (glow) glow.style.opacity = "0"; });
  }

  // Gentle 3D parallax in the hero; no sensor permissions or external libraries.
  const heroArt = document.querySelector(".hero-art");
  const artCore = document.querySelector(".art-core");
  if (heroArt && artCore && finePointer && !reduceMotion) {
    heroArt.addEventListener("pointermove", event => {
      const box = heroArt.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      artCore.style.setProperty("--float-x", (x * 8).toFixed(1) + "px");
      artCore.style.setProperty("--float-y", (y * 8).toFixed(1) + "px");
    });
    heroArt.addEventListener("pointerleave", () => {
      artCore.style.removeProperty("--float-x");
      artCore.style.removeProperty("--float-y");
    });
  }

  // Public GitHub data powers the profile metrics and a small live repository feed.
  const numberFormat = new Intl.NumberFormat("en");
  const setStat = (key, value) => {
    const node = document.querySelector('[data-stat="' + key + '"]');
    if (!node || !Number.isFinite(value)) return;
    const start = Number((node.textContent || "").replace(/[^0-9]/g, "")) || 0;
    if (reduceMotion || start === value) { node.textContent = numberFormat.format(value); return; }
    const startedAt = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - startedAt) / 720);
      node.textContent = numberFormat.format(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const relativeTime = timestamp => {
    if (!timestamp) return "DATE UNKNOWN";
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
    if (seconds < 60) return "JUST NOW";
    if (seconds < 3600) return Math.floor(seconds / 60) + "M AGO";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "H AGO";
    if (seconds < 2592000) return Math.floor(seconds / 86400) + "D AGO";
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp)).toUpperCase();
  };
  const renderActivityFeed = repositories => {
    const feed = document.getElementById("activity-feed");
    if (!feed) return;
    const items = (Array.isArray(repositories) ? repositories : [])
      .filter(repo => repo && !repo.fork && !repo.archived && repo.name && typeof repo.html_url === "string")
      .filter(repo => {
        try { return new URL(repo.html_url).hostname === "github.com"; } catch { return false; }
      })
      .sort((a, b) => new Date(b.pushed_at || b.updated_at || 0) - new Date(a.pushed_at || a.updated_at || 0))
      .slice(0, 3);
    feed.replaceChildren();
    feed.setAttribute("aria-busy", "false");
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "activity-empty";
      empty.textContent = "No public repository signals were available this time. The project list is still here when you need it.";
      feed.appendChild(empty);
      return;
    }
    items.forEach((repo, index) => {
      const row = document.createElement("article");
      row.className = "activity-row";
      row.style.animationDelay = (index * 70) + "ms";
      const nameGroup = document.createElement("div");
      nameGroup.className = "activity-name";
      const avatar = document.createElement("span");
      avatar.className = "activity-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = String(repo.name).replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "GH";
      const details = document.createElement("div");
      details.style.minWidth = "0";
      const link = document.createElement("a");
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = repo.name;
      link.setAttribute("aria-label", "Open public repository " + repo.name);
      const meta = document.createElement("small");
      meta.textContent = repo.language || "PROJECT / EXPLORATION";
      details.append(link, meta);
      nameGroup.append(avatar, details);
      const description = document.createElement("p");
      description.className = "activity-description";
      description.textContent = String(repo.description || "A project in progress.").replace(/[\r\n]+/g, " ").slice(0, 165);
      const date = document.createElement("div");
      date.className = "activity-date";
      date.textContent = relativeTime(repo.pushed_at || repo.updated_at);
      const dateSub = document.createElement("span");
      dateSub.textContent = repo.pushed_at ? "LAST PUSH" : "LAST UPDATED";
      date.appendChild(dateSub);
      row.append(nameGroup, description, date);
      feed.appendChild(row);
    });
  };
  const loadGitHubSignals = async () => {
    try {
      const [userResponse, reposResponse] = await Promise.all([
        fetch("https://api.github.com/users/arsanygeniusmina-star", { headers: { Accept: "application/vnd.github+json" } }),
        fetch("https://api.github.com/users/arsanygeniusmina-star/repos?per_page=100&sort=updated&type=owner", { headers: { Accept: "application/vnd.github+json" } })
      ]);
      if (!userResponse.ok || !reposResponse.ok) throw new Error("Public GitHub API unavailable");
      const [user, repos] = await Promise.all([userResponse.json(), reposResponse.json()]);
      setStat("repos", user.public_repos);
      setStat("followers", user.followers);
      setStat("stars", repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0));
      renderActivityFeed(repos);
    } catch (error) {
      const feed = document.getElementById("activity-feed");
      if (feed) {
        feed.setAttribute("aria-busy", "false");
        feed.replaceChildren();
        const note = document.createElement("p");
        note.className = "activity-empty";
        note.textContent = "Live signals are temporarily offline. Browse the public repositories directly — no part of this site depends on the API.";
        const link = document.createElement("a");
        link.className = "text-link";
        link.href = "https://github.com/arsanygeniusmina-star?tab=repositories";
        link.textContent = "Open all public repositories ↗";
        feed.append(note, link);
      }
    }
  };
  loadGitHubSignals();

  // Keep in-page links smooth unless the visitor has requested reduced motion.
  if (reduceMotion) {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener("click", event => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
  }
  // Reading progress and sticky header state.
  const progressBar = document.getElementById("scroll-progress-bar");
  const header = document.querySelector(".site-header");
  let scrollFrame = 0;
  const updateScrollState = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100));
      if (progressBar) progressBar.style.width = progress.toFixed(2) + "%";
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
    });
  };
  window.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("resize", updateScrollState, { passive: true });
  updateScrollState();

  // Highlight the section currently in view.
  const navLinks = Array.from(document.querySelectorAll(".main-nav a[href^='#']"));
  const navSections = navLinks.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && navSections.length) {
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.getAttribute("href") === "#" + entry.target.id) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-22% 0px -66% 0px", threshold: 0 });
    navSections.forEach(section => navObserver.observe(section));
  }

  // Lightweight signal mesh. It is disabled for reduced-motion and data-saving visitors.
  const canvas = document.getElementById("ambient-canvas");
  const canvasContext = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  let canvasWidth = 0, canvasHeight = 0, canvasNodes = [], canvasFrame = 0;
  const canvasEnabled = Boolean(canvasContext) && !reduceMotion && !navigator.connection?.saveData;
  const drawCanvas = () => {
    if (!canvasEnabled || document.hidden || !canvasContext) return;
    canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    const maxDistance = canvasWidth < 600 ? 95 : 125;
    for (let i = 0; i < canvasNodes.length; i++) {
      const node = canvasNodes[i];
      node.x += node.vx; node.y += node.vy;
      if (node.x < -8) node.x = canvasWidth + 8;
      if (node.x > canvasWidth + 8) node.x = -8;
      if (node.y < -8) node.y = canvasHeight + 8;
      if (node.y > canvasHeight + 8) node.y = -8;
      for (let k = i + 1; k < canvasNodes.length; k++) {
        const other = canvasNodes[k], dx = node.x - other.x, dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance >= maxDistance) continue;
        canvasContext.strokeStyle = "rgba(103,232,249," + (((1 - distance / maxDistance) * .16).toFixed(3)) + ")";
        canvasContext.lineWidth = .6;
        canvasContext.beginPath(); canvasContext.moveTo(node.x, node.y); canvasContext.lineTo(other.x, other.y); canvasContext.stroke();
      }
      canvasContext.fillStyle = node.radius > 1 ? "rgba(155,237,250,.54)" : "rgba(113,190,224,.3)";
      canvasContext.beginPath(); canvasContext.arc(node.x, node.y, node.radius, 0, Math.PI * 2); canvasContext.fill();
    }
    canvasFrame = requestAnimationFrame(drawCanvas);
  };
  const resizeCanvas = () => {
    if (!canvasEnabled || !canvas) return;
    if (canvasFrame) cancelAnimationFrame(canvasFrame);
    canvasFrame = 0;
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    canvasWidth = Math.max(1, bounds.width); canvasHeight = Math.max(1, bounds.height);
    canvas.width = Math.round(canvasWidth * dpr); canvas.height = Math.round(canvasHeight * dpr);
    canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    const amount = Math.min(74, Math.max(25, Math.floor(canvasWidth * canvasHeight / 24000)));
    canvasNodes = Array.from({ length: amount }, () => ({
      x: Math.random() * canvasWidth, y: Math.random() * canvasHeight,
      vx: (Math.random() - .5) * .19, vy: (Math.random() - .5) * .19,
      radius: Math.random() > .85 ? 1.55 : .85
    }));
    if (!document.hidden) drawCanvas();
  };
  if (canvasEnabled) {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (canvasFrame) cancelAnimationFrame(canvasFrame); canvasFrame = 0; }
      else drawCanvas();
    });
  }

  // Searchable command palette, reachable via Ctrl/⌘+K or slash.
  const palette = document.getElementById("command-palette");
  const paletteOpenButton = document.getElementById("command-open");
  const paletteCloseButton = document.getElementById("command-close");
  const paletteInput = document.getElementById("command-input");
  const paletteResults = document.getElementById("palette-results");
  const paletteItems = paletteResults ? Array.from(paletteResults.querySelectorAll("[data-command-item]")) : [];
  const paletteEmpty = document.getElementById("palette-empty");
  let paletteActiveIndex = -1, lastPaletteTrigger = null;
  const visiblePaletteItems = () => paletteItems.filter(item => !item.hidden);
  const setPaletteActive = index => {
    const items = visiblePaletteItems();
    paletteItems.forEach(item => { item.classList.remove("is-selected"); item.setAttribute("aria-selected", "false"); });
    if (!items.length) { paletteActiveIndex = -1; return; }
    paletteActiveIndex = (index + items.length) % items.length;
    const active = items[paletteActiveIndex];
    active.classList.add("is-selected"); active.setAttribute("aria-selected", "true");
    active.scrollIntoView({ block: "nearest" });
  };
  const filterPalette = () => {
    const query = (paletteInput?.value || "").trim().toLowerCase();
    paletteItems.forEach(item => { item.hidden = !(((item.dataset.search || "") + " " + item.textContent).toLowerCase().includes(query)); });
    if (paletteEmpty) paletteEmpty.hidden = visiblePaletteItems().length > 0;
    setPaletteActive(0);
  };
  const openPalette = trigger => {
    if (!palette) return;
    lastPaletteTrigger = trigger || document.activeElement;
    if (typeof palette.showModal === "function") { if (!palette.open) palette.showModal(); }
    else palette.setAttribute("open", "");
    if (paletteInput) { paletteInput.value = ""; filterPalette(); window.setTimeout(() => paletteInput.focus(), 0); }
  };
  const closePalette = () => {
    if (!palette) return;
    if (typeof palette.close === "function" && palette.open) palette.close();
    else palette.removeAttribute("open");
    if (lastPaletteTrigger?.isConnected) lastPaletteTrigger.focus();
  };
  paletteOpenButton?.addEventListener("click", () => openPalette(paletteOpenButton));
  paletteCloseButton?.addEventListener("click", closePalette);
  palette?.addEventListener("click", event => {
    if (event.target === palette) closePalette();
    if (event.target instanceof Element && event.target.closest("[data-command-item]")) closePalette();
  });
  paletteInput?.addEventListener("input", filterPalette);
  paletteInput?.addEventListener("keydown", event => {
    const items = visiblePaletteItems();
    if (event.key === "ArrowDown") { event.preventDefault(); setPaletteActive(paletteActiveIndex + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setPaletteActive(paletteActiveIndex - 1); }
    else if (event.key === "Enter" && items[paletteActiveIndex]) { event.preventDefault(); items[paletteActiveIndex].click(); }
  });
  document.addEventListener("keydown", event => {
    const editing = event.target instanceof HTMLElement &&
      (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette?.open) closePalette(); else openPalette(document.activeElement);
      return;
    }
    if (!editing && event.key === "/" && !event.altKey && !event.ctrlKey && !event.metaKey && !palette?.open) {
      event.preventDefault(); openPalette(document.activeElement);
    }
  });
})();