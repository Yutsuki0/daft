document.addEventListener("DOMContentLoaded", () => {
  // ---- RÉFÉRENCES DOM PRINCIPALES ----
  const btnExternal = document.getElementById("btn-external");
  const btnLocal = document.getElementById("btn-local");
  const btnFavorites = document.getElementById("btn-favorites");
  const mainAction = document.getElementById("main-action");
  const videoGrid = document.getElementById("video-grid");
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");

  // ---- MENU CATÉGORIES ----
  const btnCategories = document.getElementById("btn-categories");
  const categoriesOverlay = document.getElementById("categories-overlay");
  const categoriesList = document.getElementById("categories-list");
  const categoriesApplyBtn = document.getElementById("categories-apply");

  // ---- PLAYER LOCAL (MP4) ----
  const localPlayer = document.getElementById("local-player");
  const localVideo = document.getElementById("local-video");
  const localVideoSource = document.getElementById("local-video-source");
  const localPlayerClose = document.getElementById("local-player-close");

  // Plusieurs catégories possibles (tags actifs)
  let currentCategories = new Set(); // ex: ["tag1", "tag2"]

  // ---- DONNÉES ----
  let videosData = {
    home: [],
    local: [],
  };

  let currentView = "external"; // "external" | "local" | "favorites"
  let hasShownInitial = false;

  const PAGE_SIZE = 16;

  const visibleCount = {
    external: PAGE_SIZE,
    local: PAGE_SIZE,
    favorites: PAGE_SIZE,
  };

  const FAVORITES_STORAGE_KEY = "videoFavorites";
  let favorites = new Set();

  let searchQuery = "";

  // =========================
  //      FAVORIS
  // =========================

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      favorites = new Set(arr);
    } catch (e) {
      console.error("Erreur lecture favoris", e);
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify([...favorites])
      );
    } catch (e) {
      console.error("Erreur sauvegarde favoris", e);
    }
  }

  function isFavoriteUrl(url) {
    return favorites.has(url);
  }

  loadFavorites();

  // =========================
  //   RECHERCHE (titre/tags)
  // =========================

  function matchesSearch(video, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    if (!q) return true;

    const words = q.split(/\s+/);

    const title = (video.title || "").toLowerCase();
    const tags = Array.isArray(video.tags) ? video.tags.join(" ") : "";
    const tagsLower = tags.toLowerCase();

    const haystack = `${title} ${tagsLower}`;

    return words.every((w) => haystack.includes(w));
  }

  function applySearch() {
    if (!searchInput) return;

    searchQuery = searchInput.value.toLowerCase().trim();

    const key = getCurrentKey();
    visibleCount[key] = PAGE_SIZE;

    renderVideos();
  }

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applySearch();
    });

    searchInput.addEventListener("input", () => {
      applySearch();
    });
  }

  // =========================
  //       HELPERS LISTE
  // =========================

  function getCurrentList() {
    let base = [];

    // Si des tags sont actifs → on mélange Home + Local
    if (currentCategories.size > 0) {
      base = [...(videosData.home || []), ...(videosData.local || [])];
    } else {
      // Comportement normal suivant la vue
      if (currentView === "external") {
        base = videosData.home || [];
      } else if (currentView === "local") {
        base = videosData.local || [];
      } else if (currentView === "favorites") {
        base = [...(videosData.home || []), ...(videosData.local || [])].filter(
          (video) => favorites.has(video.url)
        );
      }
    }

    // Filtre par catégories (ET logique : la vidéo doit contenir tous les tags sélectionnés)
    if (currentCategories.size > 0) {
      base = base.filter((video) => {
        if (!Array.isArray(video.tags)) return false;
        const tagsLower = video.tags.map((t) => String(t).toLowerCase().trim());
        return [...currentCategories].every((wanted) =>
          tagsLower.includes(wanted)
        );
      });
    }

    // Filtre recherche
    if (searchQuery) {
      base = base.filter((video) => matchesSearch(video, searchQuery));
    }

    return base;
  }

  function getCurrentKey() {
    if (currentView === "external") return "external";
    if (currentView === "local") return "local";
    return "favorites";
  }

  function flagOverflowTitles() {
    const cards = document.querySelectorAll(".video-card");
    cards.forEach((card) => {
      const titleEl = card.querySelector(".video-title");
      if (!titleEl) return;

      const hasOverflow = titleEl.scrollHeight > titleEl.clientHeight + 1;
      if (hasOverflow) {
        card.classList.add("has-overflow");
      } else {
        card.classList.remove("has-overflow");
      }
    });
  }

  // =========================
  // ORIENTATION DES IMAGES
  // =========================

  function applyOrientationClasses() {
    const cards = document.querySelectorAll(".video-card");

    cards.forEach((card) => {
      const img = card.querySelector(".thumb");
      if (!img) return;

      function setClassFromRatio() {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;

        card.classList.remove("portrait", "landscape");

        if (h > w * 1.05) {
          card.classList.add("portrait");
        } else {
          card.classList.add("landscape");
        }
      }

      if (img.complete) {
        setClassFromRatio();
      } else {
        img.addEventListener("load", setClassFromRatio, { once: true });
      }
    });
  }

  // =========================
  //   ATTENTE DES IMAGES
  // =========================

  function waitForImages(container) {
    const imgs = Array.from(container.querySelectorAll("img"));
    if (!imgs.length) return Promise.resolve();

    let remaining = imgs.length;

    return new Promise((resolve) => {
      const done = () => {
        remaining--;
        if (remaining <= 0) resolve();
      };

      imgs.forEach((img) => {
        if (img.complete) {
          done();
        } else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      });
    });
  }

  // =========================
  //   RENDU + PAGINATION
  // =========================

  function renderVideos() {
    if (!videoGrid) return;

    const list = getCurrentList();
    const key = getCurrentKey();
    const maxToShow = visibleCount[key] || PAGE_SIZE;

    const slice = list.slice(0, maxToShow);

    if (!slice.length) {
      videoGrid.innerHTML =
        '<div class="empty">Aucune vidéo à afficher pour ce mode.</div>';
      return;
    }

    const html = slice
      .map((video) => {
        const title = video.title || "Vidéo sans titre";
        const thumb = video.thumb || "";
        const url = video.url || "";
        const tags = Array.isArray(video.tags) ? video.tags : [];
        const isFav = url && isFavoriteUrl(url);

        const tagsHtml = tags
          .map((tag) => `<span class="video-tag">${tag}</span>`)
          .join(" ");

        return `
          <article class="video-card">
            <a class="thumb-link" href="${url}">
              <img class="thumb" src="${thumb}" alt="${title}" loading="lazy">
            </a>
            <div class="video-meta">
              <div class="video-text">
                <h2 class="video-title">${title}</h2>
                ${tagsHtml ? `<div class="video-tags">${tagsHtml}</div>` : ""}
              </div>
              <button
                class="fav-btn ${isFav ? "fav-btn--active" : ""}"
                type="button"
                aria-label="Ajouter aux favoris"
                aria-pressed="${isFav ? "true" : "false"}"
                data-url="${url}"
              >
                ♥
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    videoGrid.innerHTML = html;
    applyOrientationClasses();
    flagOverflowTitles();

    // Premier chargement : on attend que les images soient prêtes
    if (!hasShownInitial) {
      document.body.classList.add("is-initial-loading");

      waitForImages(videoGrid).then(() => {
        hasShownInitial = true;
        document.body.classList.remove("is-initial-loading");
      });
    }
  }

  function appendVideos(fromIndex, toIndex) {
    if (!videoGrid) return;

    const list = getCurrentList();
    const slice = list.slice(fromIndex, toIndex);

    if (!slice.length) return;

    const html = slice
      .map((video) => {
        const title = video.title || "Vidéo sans titre";
        const thumb = video.thumb || "";
        const url = video.url || "";
        const tags = Array.isArray(video.tags) ? video.tags : [];
        const isFav = url && isFavoriteUrl(url);

        const tagsHtml = tags
          .map((tag) => `<span class="video-tag">${tag}</span>`)
          .join(" ");

        return `
          <article class="video-card">
            <a class="thumb-link" href="${url}">
              <img class="thumb" src="${thumb}" alt="${title}" loading="lazy">
            </a>
            <div class="video-meta">
              <div class="video-text">
                <h2 class="video-title">${title}</h2>
                ${tagsHtml ? `<div class="video-tags">${tagsHtml}</div>` : ""}
              </div>
              <button
                class="fav-btn ${isFav ? "fav-btn--active" : ""}"
                type="button"
                aria-label="Ajouter aux favoris"
                aria-pressed="${isFav ? "true" : "false"}"
                data-url="${url}"
              >
                ♥
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    videoGrid.insertAdjacentHTML("beforeend", html);
    applyOrientationClasses();
    flagOverflowTitles();
  }

  function handleScrollLoadMore() {
    const list = getCurrentList();
    const key = getCurrentKey();

    if (visibleCount[key] >= list.length) return;

    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - 200;

    if (scrollPosition >= threshold) {
      const previousCount = visibleCount[key];
      visibleCount[key] = Math.min(visibleCount[key] + PAGE_SIZE, list.length);
      appendVideos(previousCount, visibleCount[key]);
    }
  }

  // =========================
  //    VUES + BOUTONS
  // =========================

  function setActiveView(view) {
    currentView = view;

    if (btnExternal) {
      btnExternal.setAttribute("aria-pressed", String(view === "external"));
    }
    if (btnLocal) {
      btnLocal.setAttribute("aria-pressed", String(view === "local"));
    }
    if (btnFavorites) {
      btnFavorites.setAttribute("aria-pressed", String(view === "favorites"));
    }

    const key = getCurrentKey();
    if (!visibleCount[key]) {
      visibleCount[key] = PAGE_SIZE;
    }

    renderVideos();
  }

  // Bouton aléatoire : on ouvre juste le lien dans un nouvel onglet
  function openRandomVideo() {
    const list = getCurrentList();
    if (!list.length) return;

    const randomIndex = Math.floor(Math.random() * list.length);
    const video = list[randomIndex];

    if (video && video.url) {
      window.open(video.url, "_blank", "noopener");
    }
  }

  if (btnExternal) {
    btnExternal.addEventListener("click", () => setActiveView("external"));
  }

  if (btnLocal) {
    btnLocal.addEventListener("click", () => setActiveView("local"));
  }

  if (btnFavorites) {
    btnFavorites.addEventListener("click", () => setActiveView("favorites"));
  }

  if (mainAction) {
    mainAction.addEventListener("click", openRandomVideo);
  }

  window.addEventListener("scroll", handleScrollLoadMore);

  // =========================
  //     PLAYER LOCAL
  // =========================

  if (localPlayerClose) {
    localPlayerClose.addEventListener("click", () => {
      localPlayer.classList.remove("active");
      localVideo.pause();
    });
  }

  if (localPlayer) {
    localPlayer.addEventListener("click", (e) => {
      if (e.target === localPlayer) {
        localPlayer.classList.remove("active");
        localVideo.pause();
      }
    });
  }

  // =========================
  //     GRID CLICS : favoris + lecture
  // =========================

  if (videoGrid) {
    videoGrid.addEventListener("click", (e) => {
      // 1) CLIC SUR LE BOUTON FAVORI
      const favBtn = e.target.closest(".fav-btn");
      if (favBtn) {
        const url = favBtn.dataset.url;
        if (!url) return;

        if (favorites.has(url)) {
          favorites.delete(url);
          favBtn.classList.remove("fav-btn--active");
          favBtn.setAttribute("aria-pressed", "false");
        } else {
          favorites.add(url);
          favBtn.classList.add("fav-btn--active");
          favBtn.setAttribute("aria-pressed", "true");
        }

        saveFavorites();

        if (currentView === "favorites") {
          visibleCount.favorites = PAGE_SIZE;
          renderVideos();
        }

        return; // on ne traite pas ce clic comme une ouverture vidéo
      }

      // 2) CLIC SUR LA VIGNETTE VIDÉO
      const link = e.target.closest(".thumb-link");
      if (!link) return;

      const url = link.getAttribute("href") || "";

      // ⬇️ SI MP4 LOCAL → lecteur interne
      if (url.endsWith(".mp4")) {
        e.preventDefault();
        localVideo.pause();
        localVideoSource.src = url;
        localVideo.load();
        localPlayer.classList.add("active");
        localVideo.play().catch(() => {});
        return;
      }

      // ⬇️ SINON → ouvrir dans un nouvel onglet
      e.preventDefault(); // empêche navigation dans la même page
      window.open(url, "_blank", "noopener"); // ouvre dans un nouvel onglet
      return;

      // Sinon, comportement normal, le lien s'ouvre dans la même page
      // (si tu veux repasser en _blank pour YouTube seulement, on pourra adapter)
    });
  }

  // =========================
  //   MENU CATÉGORIES
  // =========================

  function buildCategoriesMenu() {
    if (!categoriesList) return;

    const all = [...(videosData.home || []), ...(videosData.local || [])];
    const tagsSet = new Set();

    all.forEach((video) => {
      if (Array.isArray(video.tags)) {
        video.tags.forEach((t) => {
          const tagNorm = String(t).toLowerCase().trim();
          if (tagNorm) tagsSet.add(tagNorm);
        });
      }
    });

    const tags = Array.from(tagsSet).sort((a, b) => a.localeCompare(b, "fr"));

    let html = `
      <button
        class="category-pill ${
          currentCategories.size === 0 ? "category-pill--active" : ""
        }"
        type="button"
        data-tag=""
      >
        Tout
      </button>
    `;

    tags.forEach((tag) => {
      const isActive = currentCategories.has(tag);
      html += `
        <button
          class="category-pill ${isActive ? "category-pill--active" : ""}"
          type="button"
          data-tag="${tag}"
        >
          ${tag}
        </button>
      `;
    });

    categoriesList.innerHTML = html;
  }

  function openCategoriesMenu() {
    if (!categoriesOverlay) return;
    buildCategoriesMenu();
    categoriesOverlay.classList.add("is-open");
  }

  function closeCategoriesMenu() {
    if (!categoriesOverlay) return;
    categoriesOverlay.classList.remove("is-open");
  }

  // Ouverture via le bouton Catégories
  if (btnCategories && categoriesOverlay) {
    btnCategories.addEventListener("click", openCategoriesMenu);
  }

  // Fermeture si on clique sur le fond flouté
  if (categoriesOverlay) {
    categoriesOverlay.addEventListener("click", (e) => {
      if (e.target === categoriesOverlay) {
        closeCategoriesMenu();
      }
    });
  }

  // Clic sur les tags dans le menu
  if (categoriesList) {
    categoriesList.addEventListener("click", (e) => {
      const pill = e.target.closest(".category-pill");
      if (!pill) return;

      const tag = (pill.dataset.tag || "").toLowerCase().trim();

      const allBtn = categoriesList.querySelector('[data-tag=""]');

      // Bouton "Tout"
      if (!tag) {
        currentCategories.clear();

        const allPills = categoriesList.querySelectorAll(".category-pill");
        allPills.forEach((p) => p.classList.remove("category-pill--active"));

        pill.classList.add("category-pill--active");
        return;
      }

      // On désactive "Tout"
      if (allBtn) allBtn.classList.remove("category-pill--active");

      // Toggle du tag dans le Set
      if (currentCategories.has(tag)) {
        currentCategories.delete(tag);
        pill.classList.remove("category-pill--active");
      } else {
        currentCategories.add(tag);
        pill.classList.add("category-pill--active");
      }

      // Si tout est désélectionné → on revient à "Tout"
      if (currentCategories.size === 0 && allBtn) {
        allBtn.classList.add("category-pill--active");
      }
    });
  }

  // Bouton "Appliquer"
  if (categoriesApplyBtn && categoriesOverlay) {
    categoriesApplyBtn.addEventListener("click", () => {
      closeCategoriesMenu();
      renderVideos();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // =========================
  //   CHARGEMENT DU JSON
  // =========================

  fetch("videos.json")
    .then((res) => res.json())
    .then((data) => {
      videosData = data || { home: [], local: [] };

      visibleCount.external = PAGE_SIZE;
      visibleCount.local = PAGE_SIZE;
      visibleCount.favorites = PAGE_SIZE;

      setActiveView("external");
    })
    .catch((err) => {
      console.error("Erreur de chargement de videos.json :", err);
      if (videoGrid) {
        videoGrid.innerHTML =
          '<div class="empty">Impossible de charger les vidéos.</div>';
      }
    });
});
