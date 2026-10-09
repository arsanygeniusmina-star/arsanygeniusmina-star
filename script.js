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
      const categories = (card.dataset.categories || "").split(/\\s+/);
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

  // Public, unauthenticated GitHub API only; leave clean fallback values if rate-limited.
  const numberFormat = new Intl.NumberFormat("en");
  const setStat = (key, value) => {
    const node = document.querySelector('[data-stat="' + key + '"]');
    if (node && Number.isFinite(value)) node.textContent = numberFormat.format(value);
  };
  const loadGitHubSignals = async () => {
    try {
      const [userResponse, reposResponse] = await Promise.all([
        fetch("https://api.github.com/users/arsanygeniusmina-star", { headers: { Accept: "application/vnd.github+json" } }),
        fetch("https://api.github.com/users/arsanygeniusmina-star/repos?per_page=100&sort=updated&type=owner", { headers: { Accept: "application/vnd.github+json" } })
      ]);
      if (!userResponse.ok || !reposResponse.ok) throw new Error("Public GitHub API unavailable");
      const user = await userResponse.json();
      const repos = await reposResponse.json();
      setStat("repos", user.public_repos);
      setStat("followers", user.followers);
      setStat("stars", repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0));
    } catch (error) {
      // Keep the static em-dash fallbacks: the portfolio should never depend on the API.
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
})();