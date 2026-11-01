// ==========================================================================
// GPTR TV - Core Application Engine
// Full Live TV Channels, Movies (VOD), TV Series, Cricket, Bigg Boss & Music
// ==========================================================================

// Global Application Controller Object
// Global Application Controller Object
window.GPTR_APP = {
  state: {
    currentTab: "home",
    channels: [...(window.GPTR_UNLOCKED_CHANNELS || window.GPTR_DATA?.channels || [])],
    movies: [...(window.GPTR_UNLOCKED_MOVIES || window.GPTR_DATA?.movies || [])],
    series: [...(window.GPTR_UNLOCKED_SERIES || window.GPTR_DATA?.series || [])],
    favorites: JSON.parse(localStorage.getItem("gptrtv_favs") || "[]"),
    activeCategory: "All",
    activeMovieGenre: "All",
    currentChannelIndex: 0,
    currentVideoItem: null,
    hls: null,
    aspectRatioIndex: 0,
    aspectRatios: ["contain", "cover", "fill"],
    userPlaylists: JSON.parse(localStorage.getItem("gptrtv_playlists") || "[]"),
    accessCodes: JSON.parse(localStorage.getItem("gptrtv_access_codes") || "[]"),
    activeCode: localStorage.getItem("gptrtv_active_code") || "",
    session: (() => {
      try {
        const saved = JSON.parse(localStorage.getItem("gptrtv_session") || "null");
        if (!saved || typeof saved !== "object") return null;
        const { xtreamUsername, xtreamPassword, ...safeSession } = saved;
        return safeSession;
      } catch {
        return null;
      }
    })(),
    liveCategories: window.GPTR_CATEGORIES || [],
    liveCurrentPage: 1,
    livePageSize: 60,
    isLoadingCatalog: false,
    // Music
    currentTrack: window.GPTR_DATA?.music?.trending?.[0] || null,
    isPlayingMusic: false,
    audioElement: new Audio(),
    currentLyricIndex: 0,
    theme: localStorage.getItem("gptrtv_theme") || "default"
  }
};

// Immediate safety binding to ensure all 14,740 unlocked channels & VOD are linked
if (typeof window !== "undefined") {
  if (window.GPTR_UNLOCKED_CHANNELS && window.GPTR_UNLOCKED_CHANNELS.length > 0) {
    window.GPTR_APP.state.channels = window.GPTR_UNLOCKED_CHANNELS;
  }
  if (window.GPTR_CATEGORIES && window.GPTR_CATEGORIES.length > 0) {
    window.GPTR_APP.state.liveCategories = window.GPTR_CATEGORIES;
  }
  if (window.GPTR_UNLOCKED_MOVIES && window.GPTR_UNLOCKED_MOVIES.length > 0) {
    window.GPTR_APP.state.movies = window.GPTR_UNLOCKED_MOVIES;
  }
  if (window.GPTR_UNLOCKED_SERIES && window.GPTR_UNLOCKED_SERIES.length > 0) {
    window.GPTR_APP.state.series = window.GPTR_UNLOCKED_SERIES;
  }
}


function escapeQuotes(str) {
  if (!str) return "";
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function safeMediaImageUrl(value, fallback = "img/logo.png") {
  const url = String(value ?? "").trim();
  if (!url) return fallback;
  if (/^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(url)) return url;
  return fallback;
}

function renderMediaCards(container, items, type) {
  if (!container) return;
  const isSeries = type === "series";
  container.innerHTML = items.map((item, index) => {
    const title = escapeHtml(item.title);
    const poster = escapeHtml(safeMediaImageUrl(item.poster));
    const rating = escapeHtml(item.rating ?? "N/A");
    const subtitle = isSeries
      ? (item.seasonsCount ? `${escapeHtml(item.seasonsCount)} Seasons` : "TV Series")
      : escapeHtml(item.year ?? "");
    const genre = escapeHtml(item.genre ?? "");
    const ratingMarkup = item.rating && item.rating !== "N/A"
      ? `${ratingMarkup}`
      : "";
    return `
      <div class="media-card" data-media-index="${index}" tabindex="0" role="button" aria-label="Open ${title}">
        <div class="media-poster-wrap">
          <img class="media-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='img/logo.png'">
          <div class="media-rating">★ ${rating}</div>
          <div class="media-overlay">
            <div class="play-circle"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          </div>
        </div>
        <div class="media-info">
          <h4 class="media-title">${title}</h4>
          <div class="media-sub"><span>${subtitle}</span><span>${genre}</span></div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-media-index]").forEach(card => {
    const openDetails = () => {
      const item = items[Number(card.dataset.mediaIndex)];
      if (item) window.openDetailModal(item, type);
    };
    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });
  });
}

// Top-level Global Helper Handlers
window.switchTab = function(tabId) {
  const s = window.GPTR_APP.state;
  s.currentTab = tabId;

  document.querySelectorAll(".nav-item, .top-tab-item").forEach(item => {
    item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
  });

  document.querySelectorAll(".content-view").forEach(view => {
    view.classList.toggle("active", view.id === `view-${tabId}`);
  });

  setMobileSidebarOpen(false);
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (tabId === "live") renderLiveChannels();
  if (tabId === "movies") renderMovies();
  if (tabId === "series") renderSeries();
  if (tabId === "sports") renderCricketSection();
  if (tabId === "bigboss") renderBiggBoss();
  if (tabId === "music") renderMusicSection();
  if (tabId === "codes") renderAccessCodes();
};

window.showPlayerStatus = function(msg, isError = false, showActions = false) {
  const overlay = document.getElementById("playerStatusOverlay");
  const text = document.getElementById("playerStatusMsg");
  const actions = document.getElementById("playerStatusActions");
  const spinner = overlay ? overlay.querySelector(".player-spinner") : null;

  if (!overlay || !text) return;
  overlay.classList.remove("hidden");
  overlay.classList.add("active");
  text.textContent = msg;

  if (isError) {
    if (spinner) spinner.style.display = "none";
    if (actions) actions.style.display = "flex";
  } else {
    if (spinner) spinner.style.display = "block";
    if (actions) actions.style.display = showActions ? "flex" : "none";
  }
};

window.hidePlayerStatus = function() {
  const overlay = document.getElementById("playerStatusOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.classList.remove("active");
  }
};

window.showUnmuteBanner = function() {
  const btn = document.getElementById("unmuteBannerBtn");
  if (btn) btn.style.display = "flex";
};

window.hideUnmuteBanner = function() {
  const btn = document.getElementById("unmuteBannerBtn");
  if (btn) btn.style.display = "none";
};

window.unmuteVideo = function() {
  const video = document.getElementById("mainVideoPlayer");
  if (video) {
    video.muted = false;
    video.volume = 1.0;
    video.play().catch(e => console.log(e));
  }
  window.hideUnmuteBanner();
};


window.openVideoPlayer = function(item, engine = null) {
  const s = window.GPTR_APP.state;
  s.currentVideoItem = item;

  const modal = document.getElementById("videoPlayerModal");
  if (!modal) return;
  modal.classList.add("active");

  const title = document.getElementById("osdChannelTitle");
  const epg = document.getElementById("osdChannelEpg");
  const logo = document.getElementById("osdChannelLogo");
  const video = document.getElementById("mainVideoPlayer");
  const engineBtn = document.getElementById("osdEngineBtn");

  if (title) title.textContent = item.title;
  if (epg) epg.textContent = item.epg || "";
  if (logo) logo.src = item.logo || "img/logo.png";

  renderChannelDrawer();
  window.showPlayerStatus(`Connecting to ${item.title}...`);

  // Clean up any previously running watchdog timer
  if (s.streamWatchdogTimer) {
    clearTimeout(s.streamWatchdogTimer);
    s.streamWatchdogTimer = null;
  }
  if (s.bufferingTimeout) {
    clearTimeout(s.bufferingTimeout);
    s.bufferingTimeout = null;
  }

  // Clean up any previously running players
  if (s.mpegtsPlayer) {
    try {
      s.mpegtsPlayer.pause();
      s.mpegtsPlayer.unload();
      s.mpegtsPlayer.detachMediaElement();
      s.mpegtsPlayer.destroy();
    } catch (e) {
      console.warn("mpegts destroy:", e);
    }
    s.mpegtsPlayer = null;
  }
  if (s.hls) {
    try {
      s.hls.destroy();
    } catch (e) {
      console.warn("hls destroy:", e);
    }
    s.hls = null;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();

  window.hideUnmuteBanner();

  // Attach status and error handlers on the HTML5 video element
  video.onloadeddata = () => {
    console.log("[VIDEO] First frame data arrived!");
    window.hidePlayerStatus();
    if (s.streamWatchdogTimer) {
      clearTimeout(s.streamWatchdogTimer);
      s.streamWatchdogTimer = null;
    }
    video.play().catch(e => {
      console.warn("[AUTOPLAY BLOCKED] Retrying muted:", e);
      video.muted = true;
      video.play().catch(err => console.error("Muted play failed:", err));
      window.showUnmuteBanner();
    });
  };

  video.oncanplay = () => {
    window.hidePlayerStatus();
    if (s.streamWatchdogTimer) {
      clearTimeout(s.streamWatchdogTimer);
      s.streamWatchdogTimer = null;
    }
    if (video.paused) {
      video.play().catch(e => {
        video.muted = true;
        video.play().catch(err => console.error(err));
        window.showUnmuteBanner();
      });
    }
  };

  video.onplaying = () => {
    window.hidePlayerStatus();
    if (s.streamWatchdogTimer) {
      clearTimeout(s.streamWatchdogTimer);
      s.streamWatchdogTimer = null;
    }
    const playBtn = document.getElementById("osdPlayBtn");
    if (playBtn) playBtn.textContent = "⏸ Pause";
  };

  video.ontimeupdate = () => {
    if (video.currentTime > 0.05) {
      window.hidePlayerStatus();
      if (s.streamWatchdogTimer) {
        clearTimeout(s.streamWatchdogTimer);
        s.streamWatchdogTimer = null;
      }
    }
  };

  video.onwaiting = () => {
    if (video.currentTime > 0.5 && !video.paused) {
      if (s.bufferingTimeout) clearTimeout(s.bufferingTimeout);
      s.bufferingTimeout = setTimeout(() => {
        if (video.readyState < 3 && !video.paused) {
          window.showPlayerStatus("Buffering live feed...");
        }
      }, 1500);
    }
  };

  video.onerror = () => {
    console.warn("Video element error:", video.error);
    window.showPlayerStatus("Stream connection error. Click Retry to reconnect.", true, true);
  };

  const streamUrl = item.streamUrl || "";
  const isMovie = streamUrl.includes("/stream/movie/") || streamUrl.includes("/stream/series/") || streamUrl.endsWith(".mp4") || streamUrl.endsWith(".mkv");

  if (isMovie) {
    if (engineBtn) engineBtn.textContent = "🎬 VOD";
    s.currentEngine = "vod";
    video.src = streamUrl;
    video.play().catch(e => console.log("Movie play:", e));
    showOSD();
    return;
  }

  // Extract stream ID for live IPTV
  const streamId = item.stream_id || (streamUrl.match(/\/live\/(\d+)/) || [])[1] || (item.channelId && item.channelId.replace("xtream_", ""));
  const tsUrl = streamId ? `/stream/live/${streamId}.ts` : (item.directUrl || streamUrl);
  const isExternalHls = streamUrl.includes(".m3u8") && !streamId;

  // For live IPTV, default to mpegts (rock-solid, 0% CPU); allow HLS only when specifically chosen
  let chosenEngine = engine;
  if (!chosenEngine) {
    chosenEngine = isExternalHls ? "hls" : "mpegts";
  }
  s.currentEngine = chosenEngine;

  if (chosenEngine === "mpegts" && window.mpegts && window.mpegts.isSupported()) {
    if (engineBtn) engineBtn.textContent = "⚡ Engine: TS";
    window.showPlayerStatus("📡 Connecting live feed... (Acquiring stream)");

    try {
      const player = window.mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: tsUrl
      }, {
        enableWorker: false,
        lazyLoad: false,
        enableStashBuffer: true,
        stashInitialSize: 512 * 1024, // 512KB healthy initial buffer prevents startup stutter
        liveBufferLatencyChasing: false, // CRITICAL: false guarantees buttery smooth broadcast playback without micro-stutters or speed jumps!
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 120,
        autoCleanupMinBackwardDuration: 60,
        fixAudioTimestampGap: true,
        accurateSeek: false
      });

      s.mpegtsPlayer = player;
      player.attachMediaElement(video);
      player.load();
      const p = player.play();
      if (p && p.catch) {
        p.catch(err => {
          console.warn("[AUTOPLAY] Retrying muted:", err);
          video.muted = true;
          player.play().catch(e => console.log(e));
          window.showUnmuteBanner();
        });
      }

      // Auto-recovery watchdog: give cold-starting satellite feeds up to 25s
      s.streamWatchdogTimer = setTimeout(() => {
        if (video.currentTime <= 0.05 && s.currentEngine === "mpegts") {
          console.warn("[STREAM WATCHDOG] MPEG-TS did not start; trying HLS fallback.");
          if ((window.Hls && window.Hls.isSupported()) || video.canPlayType("application/vnd.apple.mpegurl")) {
            window.showPlayerStatus("MPEG-TS is taking too long. Switching to HLS…");
            window.openVideoPlayer(s.currentVideoItem, "hls");
          } else {
            window.showPlayerStatus("Connection timed out. Check the stream or try another channel.", true, true);
          }
        }
      }, 25000);

      player.on(window.mpegts.Events.ERROR, (errType, errDetail, errInfo) => {
        console.warn("[MPEGTS Notice]", errType, errDetail, errInfo);
        if (errType === window.mpegts.ErrorTypes.MEDIA_ERROR) {
          console.log("[MPEGTS] Media decode hiccup, calling recoverMediaError()...");
          try {
            player.recoverMediaError();
          } catch (e) {
            console.warn("recoverMediaError failed:", e);
          }
        } else if (errType === window.mpegts.ErrorTypes.NETWORK_ERROR) {
          console.warn("[MPEGTS] Network hiccup from upstream, auto-reconnecting TS stream...");
          window.showPlayerStatus("Stream interrupted. Reconnecting feed...");
          setTimeout(() => {
            if (s.currentVideoItem && s.currentEngine === "mpegts") {
              window.openVideoPlayer(s.currentVideoItem, "mpegts");
            }
          }, 1500);
        }
      });
    } catch (e) {
      console.error("MPEGTS Init exception:", e);
      window.showPlayerStatus("Player initialization error. Click Retry.", true, true);
    }
  } else if (window.Hls && window.Hls.isSupported()) {
    // Reflect the actual fallback engine when MPEG-TS is unavailable.
    s.currentEngine = "hls";
    if (engineBtn) engineBtn.textContent = "📡 Engine: HLS";
    window.showPlayerStatus("📡 Connecting via HLS Transmuxer... (Buffering)");

    const hlsUrl = streamId ? `/stream/hls/${streamId}/index.m3u8` : streamUrl;
    const hls = new window.Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 60,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      maxBufferHole: 0.5,
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 8,
      manifestLoadingTimeOut: 25000,
      manifestLoadingMaxRetry: 6,
      fragLoadingTimeOut: 25000,
      fragLoadingMaxRetry: 6
    });
    s.hls = hls;
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(e => {
        video.muted = true;
        video.play().catch(err => console.log(err));
        window.showUnmuteBanner();
      });
    });
    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.warn("[HLS Error]", data);
      if (data.fatal) {
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          window.showPlayerStatus("Stream error from upstream server. Click Retry.", true, true);
        }
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl") && (isExternalHls || streamId)) {
    // Safari/iOS supports HLS natively even when MediaSource-based HLS.js is unavailable.
    s.currentEngine = "native-hls";
    if (engineBtn) engineBtn.textContent = "🍎 Native HLS";
    video.src = isExternalHls ? streamUrl : `/stream/live/${streamId}.m3u8`;
    video.play().catch(err => {
      console.warn("[NATIVE HLS] Autoplay blocked:", err);
      video.muted = true;
      video.play().catch(console.warn);
      window.showUnmuteBanner();
    });
  } else {
    s.currentEngine = "direct";
    if (engineBtn) engineBtn.textContent = "🌐 Direct";
    video.src = tsUrl;
    video.play().catch(e => {
      console.warn("[DIRECT] Playback failed:", e);
      window.showPlayerStatus("This browser cannot play this stream format. Try switching the player engine.", true, true);
    });
  }

  showOSD();
};

window.togglePlayerEngine = function() {
  const s = window.GPTR_APP.state;
  if (!s.currentVideoItem) return;
  const newEngine = s.currentEngine === "mpegts" ? "hls" : "mpegts";
  window.openVideoPlayer(s.currentVideoItem, newEngine);
};

window.retryCurrentStream = function() {
  const s = window.GPTR_APP.state;
  if (!s.currentVideoItem) return;
  window.openVideoPlayer(s.currentVideoItem, s.currentEngine || "mpegts");
};

window.playNextChannel = function() {
  const s = window.GPTR_APP.state;
  if (!s.channels || s.channels.length === 0) return;
  s.currentChannelIndex = (s.currentChannelIndex + 1) % s.channels.length;
  const nextCh = s.channels[s.currentChannelIndex];
  if (nextCh) {
    window.openVideoPlayer({
      title: nextCh.name,
      epg: nextCh.category,
      logo: nextCh.logo,
      streamUrl: nextCh.streamUrl,
      directUrl: nextCh.directUrl || '',
      channelId: nextCh.id,
      stream_id: nextCh.stream_id || ''
    });
  }
};

window.closeVideoPlayer = function() {
  const s = window.GPTR_APP.state;
  window.hideUnmuteBanner();
  if (s.streamConnectTimer) clearTimeout(s.streamConnectTimer);
  if (s.streamWatchdogTimer) {
    clearTimeout(s.streamWatchdogTimer);
    s.streamWatchdogTimer = null;
  }
  if (s.mpegtsPlayer) {
    try {
      s.mpegtsPlayer.pause();
      s.mpegtsPlayer.unload();
      s.mpegtsPlayer.detachMediaElement();
      s.mpegtsPlayer.destroy();
    } catch (e) {}
    s.mpegtsPlayer = null;
  }
  if (s.hls) {
    try {
      s.hls.destroy();
    } catch (e) {}
    s.hls = null;
  }
  const video = document.getElementById("mainVideoPlayer");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  window.hidePlayerStatus();
  document.getElementById("videoPlayerModal")?.classList.remove("active");
  document.getElementById("channelDrawer")?.classList.remove("open");
};

window.openDetailModal = function(item, type) {
  const modal = document.getElementById("detailModal");
  if (!modal) return;

  const hero = document.getElementById("detailHero");
  const title = document.getElementById("detailTitle");
  const meta = document.getElementById("detailMeta");
  const syn = document.getElementById("detailSynopsis");
  const cast = document.getElementById("detailCast");
  const epContainer = document.getElementById("detailEpisodes");
  const playBtn = document.getElementById("detailPlayBtn");

  if (hero) hero.style.backgroundImage = `url('${item.backdrop || item.poster}')`;
  if (title) title.textContent = item.title;
  if (syn) syn.textContent = item.synopsis;

  if (type === "movie") {
    if (meta) meta.textContent = `${item.year} • ${item.duration} • ★ ${item.rating} • ${item.genre}`;
    if (cast) cast.textContent = `Director: ${item.director} | Cast: ${item.cast}`;
    if (epContainer) epContainer.style.display = "none";
    if (playBtn) {
      playBtn.onclick = () => {
        closeDetailModal();
        window.openVideoPlayer({
          title: item.title,
          epg: `${item.year} • ${item.genre}`,
          logo: item.poster,
          streamUrl: item.streamUrl
        });
      };
    }
  } else {
    // TV Series
    if (meta) meta.textContent = `${item.seasonsCount || 1} Seasons • ★ ${item.rating || 8.0} • ${item.genre || 'Series'}`;
    if (cast) cast.textContent = item.synopsis || item.description || "";
    if (epContainer) {
      epContainer.style.display = "block";
      const renderEpisodesList = () => {
        const s1 = item.seasons?.[0];
        if (s1 && s1.episodes && s1.episodes.length > 0) {
          epContainer.innerHTML = `
            <h4 style="margin-bottom: 12px; font-weight: 700;">Season ${escapeHtml(s1.seasonNumber || 1)} Episodes (${s1.episodes.length})</h4>
            <div class="episodes-list">
              ${s1.episodes.map((ep, index) => `
                <button type="button" class="episode-item" data-episode-index="${index}" style="width:100%;text-align:left;">
                  <div>
                    <strong>E${escapeHtml(ep.episodeNumber)}. ${escapeHtml(ep.title)}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(ep.duration || '45m')} ${ep.overview ? '• ' + escapeHtml(ep.overview) : ''}</div>
                  </div>
                  <span class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">▶ Play</span>
                </button>
              `).join("")}
            </div>
          `;
          epContainer.querySelectorAll("[data-episode-index]").forEach(button => {
            button.addEventListener("click", () => {
              const episode = s1.episodes[Number(button.dataset.episodeIndex)];
              if (!episode) return;
              closeDetailModal();
              window.openVideoPlayer({
                title: `${item.title} E${episode.episodeNumber}: ${episode.title}`,
                epg: "TV Episode",
                logo: safeMediaImageUrl(item.poster),
                streamUrl: episode.streamUrl
              });
            });
          });
          if (playBtn) {
            const ep1 = s1.episodes[0];
            playBtn.onclick = () => {
              closeDetailModal();
              if (ep1) {
                window.openVideoPlayer({
                  title: `${item.title} E${ep1.episodeNumber}: ${ep1.title}`,
                  epg: "TV Episode",
                  logo: item.poster,
                  streamUrl: ep1.streamUrl
                });
              }
            };
          }
        } else {
          epContainer.innerHTML = `<div style="padding: 16px; color: var(--text-muted); text-align: center;">No episodes found.</div>`;
        }
      };

      if (item.seasons && item.seasons.length > 0) {
        renderEpisodesList();
      } else {
        const sId = item.series_id || (item.id && item.id.replace("ser_", ""));
        epContainer.innerHTML = `<div style="padding: 24px; color: var(--text-muted); text-align: center;"><div class="player-spinner" style="margin: 0 auto 12px auto;"></div>Loading episodes from server...</div>`;
        fetch(`/api/catalog/series-info?series_id=${sId}`)
          .then(res => res.json())
          .then(data => {
            const epsObj = data.episodes || {};
            const sNums = Object.keys(epsObj).sort((a, b) => Number(a) - Number(b));
            if (sNums.length > 0) {
              item.seasons = sNums.map(sNum => ({
                seasonNumber: Number(sNum),
                episodes: (epsObj[sNum] || []).map(ep => ({
                  episodeNumber: ep.episode_num || ep.id,
                  title: ep.title || `Episode ${ep.episode_num}`,
                  duration: ep.info?.duration || "45m",
                  overview: ep.info?.plot || "",
                  streamUrl: `/stream/series/${ep.id}.${ep.container_extension || 'mp4'}`
                }))
              }));
              renderEpisodesList();
            } else {
              epContainer.innerHTML = `<div style="padding: 16px; color: var(--text-muted); text-align: center;">No episodes listed.</div>`;
            }
          })
          .catch(err => {
            console.warn("Error fetching series info:", err);
            epContainer.innerHTML = `<div style="padding: 16px; color: var(--text-muted); text-align: center;">Episodes currently unavailable.</div>`;
          });
      }
    }
  }

  modal.classList.add("active");
};

window.closeDetailModal = function() {
  document.getElementById("detailModal")?.classList.remove("active");
};

window.toggleFavorite = function(id) {
  const s = window.GPTR_APP.state;
  if (s.favorites.includes(id)) {
    s.favorites = s.favorites.filter(f => f !== id);
  } else {
    s.favorites.push(id);
  }
  localStorage.setItem("gptrtv_favs", JSON.stringify(s.favorites));
  renderLiveChannels(s.activeCategory);
};

// ==========================================
// RENDERERS
// ==========================================
function renderHomeView() {
  const s = window.GPTR_APP.state;

  // 1. Home Live Channels Row (First 8 channels)
  const homeCh = document.getElementById("homeChannelPreview");
  if (homeCh && s.channels.length > 0) {
    const previewChannels = s.channels.slice(0, 8);
    homeCh.innerHTML = previewChannels.map((ch, index) => {
      const isFav = s.favorites.includes(ch.id);
      const nowTitle = ch.epg?.now?.title || "Live Stream";
      const progress = Math.max(0, Math.min(100, Number(ch.epg?.now?.progress ?? 50) || 0));

      return `
        <div class="channel-card" data-home-channel-index="${index}" tabindex="0" role="button">
          <div class="channel-card-top">
            <div class="channel-logo-wrap">
              <img class="channel-logo" src="${escapeHtml(safeMediaImageUrl(ch.logo))}" alt="${escapeHtml(ch.name)}" onerror="this.onerror=null;this.src='img/logo.png'">
            </div>
            <div class="channel-badges">
              <span class="badge badge-red">LIVE</span>
              <button type="button" class="fav-btn ${isFav ? 'active' : ''}" data-home-favorite-index="${index}" aria-label="Toggle favorite">★</button>
            </div>
          </div>
          <div class="channel-info">
            <h3 class="channel-name">${escapeHtml(ch.name)}</h3>
            <span class="channel-category">${escapeHtml(ch.category)} • ${escapeHtml(ch.quality || 'HD')}</span>
          </div>
          <div class="epg-info">
            <div class="epg-now">▶ ${escapeHtml(nowTitle)}</div>
            <div class="epg-progress-bar"><div class="epg-progress-fill" style="width: ${progress}%;"></div></div>
          </div>
        </div>
      `;
    }).join("");

    homeCh.querySelectorAll("[data-home-channel-index]").forEach(card => {
      const openChannel = () => {
        const channel = previewChannels[Number(card.dataset.homeChannelIndex)];
        if (channel) window.openVideoPlayer({
          title: channel.name,
          epg: channel.epg?.now?.title || "Live Stream",
          logo: safeMediaImageUrl(channel.logo),
          streamUrl: channel.streamUrl,
          channelId: channel.id,
          stream_id: channel.stream_id || ""
        });
      };
      card.addEventListener("click", event => {
        if (!event.target.closest("[data-home-favorite-index]")) openChannel();
      });
      card.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && !event.target.closest("[data-home-favorite-index]")) {
          event.preventDefault();
          openChannel();
        }
      });
    });
    homeCh.querySelectorAll("[data-home-favorite-index]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const channel = previewChannels[Number(button.dataset.homeFavoriteIndex)];
        if (channel) window.toggleFavorite(channel.id);
      });
    });
  }

  // 2. Home Movies Row (First 6 movies)
  const homeMov = document.getElementById("homeMoviePreview");
  if (homeMov && s.movies.length > 0) {
    renderMediaCards(homeMov, s.movies.slice(0, 6), "movie");
  }

  // 3. Home Series Row (All series)
  const homeSer = document.getElementById("homeSeriesPreview");
  if (homeSer && s.series.length > 0) {
    renderMediaCards(homeSer, s.series, "series");
  }
}

function updateDOMBadges() {
  const s = window.GPTR_APP.state;
  const countStr = s.channels.length.toLocaleString();
  const badge1 = document.getElementById("liveChannelCountBadge");
  const badge2 = document.getElementById("sidebarChannelCountBadge");
  const codeBadge = document.getElementById("codeStatusBadge");
  const totalDisplay = document.getElementById("liveChannelTotalDisplay");

  if (badge1) badge1.textContent = countStr;
  if (badge2) badge2.textContent = countStr;
  if (totalDisplay) totalDisplay.textContent = `${s.channels.length.toLocaleString()} Channels Available`;

  if (s.activeCode) {
    if (codeBadge) {
      codeBadge.textContent = "VIP Active";
      codeBadge.style.color = "#10B981";
    }
    const btn = document.getElementById("btnHeaderAccessCode");
    if (btn) {
      btn.textContent = "✓ Access Active";
      btn.style.background = "linear-gradient(135deg, #10B981, #059669)";
      btn.style.boxShadow = "0 0 10px rgba(16, 185, 129, 0.4)";
    }
  }
}

function renderLiveBanner() {
  const s = window.GPTR_APP.state;
  const container = document.getElementById("liveBannerContainer");
  if (!container) return;

  if (s.activeCode) {
    container.innerHTML = `
      <div class="unlocked-banner">
        <div class="unlocked-banner-text">
          ✓ <strong>Provider access active:</strong> ${s.channels.length.toLocaleString()} live channels loaded for ${escapeHtml(s.session?.name || "your account")}.
        </div>
        <button class="btn-secondary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="window.switchTab('codes')">Manage Code</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="unlock-prompt-banner">
        <div class="unlock-prompt-text">
          🔑 <strong>Access Code Required:</strong> Connect your subscription to load live TV, movies and series from your provider.
        </div>
        <button class="btn-primary" style="padding: 6px 16px; font-size: 0.82rem; background: linear-gradient(135deg, #F59E0B, #D97706); border:none;" onclick="window.openAccessCodeModal()">
          Enter Access Code
        </button>
      </div>
    `;
  }
}

window.renderCategoryChipsList = function(categories, activeCat, queryFilter = "") {
  const chips = document.getElementById("liveCategoryChips");
  if (!chips) return;
  const s = window.GPTR_APP.state;

  let displayCats = categories;
  if (queryFilter && queryFilter.trim()) {
    const q = queryFilter.toLowerCase().trim();
    displayCats = categories.filter(c => c === "All" || c === "Favorites" || c === activeCat || c.toLowerCase().includes(q));
  }

  chips.innerHTML = displayCats.map(cat => {
    const count = cat === "All" ? s.channels.length : (cat === "Favorites" ? s.favorites.length : s.channels.filter(c => c.category === cat).length);
    return `
      <button class="chip ${cat === activeCat ? 'active' : ''}" onclick="window.selectCategoryDropdown('${escapeQuotes(cat)}')">
        ${cat} <span class="chip-count">${count.toLocaleString()}</span>
      </button>
    `;
  }).join("");
};

window.filterCategoryChips = function(query) {
  const s = window.GPTR_APP.state;
  const uniqueCats = [...new Set(s.channels.map(c => c.category))].filter(Boolean);
  const categories = ["All", "Favorites", ...uniqueCats];
  window.renderCategoryChipsList(categories, s.activeCategory || "All", query);
};

function renderLiveChannels(filterCategory = "All", searchQuery = "") {
  const s = window.GPTR_APP.state;
  s.activeCategory = filterCategory;

  renderLiveBanner();
  updateDOMBadges();

  const uniqueCats = [...new Set(s.channels.map(c => c.category))].filter(Boolean);
  const categories = ["All", "Favorites", ...uniqueCats];

  const dropdown = document.getElementById("liveCategoryDropdown");
  if (dropdown) {
    dropdown.innerHTML = categories.map(cat => {
      const count = cat === "All" ? s.channels.length : (cat === "Favorites" ? s.favorites.length : s.channels.filter(c => c.category === cat).length);
      return `<option value="${escapeQuotes(cat)}" ${cat === filterCategory ? 'selected' : ''}>${cat} (${count.toLocaleString()})</option>`;
    }).join("");
  }

  // Render ALL 157 Categories as chips! (Restored full category catalogue)
  const filterInput = document.getElementById("categoryFilterInput");
  window.renderCategoryChipsList(categories, filterCategory, filterInput ? filterInput.value : "");

  let filtered = s.channels;
  if (filterCategory === "Favorites") {
    filtered = filtered.filter(c => s.favorites.includes(c.id));
  } else if (filterCategory !== "All") {
    filtered = filtered.filter(c => c.category === filterCategory);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || (c.category && c.category.toLowerCase().includes(q)));
  }

  const grid = document.getElementById("channelGrid");
  if (!grid) return;

  if (filtered.length === 0) {
    const message = searchQuery.trim()
      ? `No channels match "${escapeHtml(searchQuery.trim())}" in this category.`
      : "No channels are currently assigned to this category.";
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: var(--text-muted);"><h3>${message}</h3><p>Clear the search or choose another category to see more channels.</p></div>`;
    return;
  }

  const pageLimit = (s.liveCurrentPage || 1) * (s.livePageSize || 60);
  const paged = filtered.slice(0, pageLimit);

  grid.innerHTML = paged.map((ch, index) => {
    const isFav = s.favorites.includes(ch.id);
    const nowTitle = ch.epg?.now?.title || "Live Stream";
    const progress = Math.max(0, Math.min(100, Number(ch.epg?.now?.progress ?? 50) || 0));

    return `
      <div class="channel-card" data-channel-index="${index}" tabindex="0" role="button">
        <div class="channel-card-top">
          <div class="channel-logo-wrap">
            <img class="channel-logo" src="${escapeHtml(ch.logo || 'img/logo.png')}" alt="${escapeHtml(ch.name)}" loading="lazy" onerror="this.onerror=null;this.src='img/logo.png'">
          </div>
          <div class="channel-badges">
            <span class="badge badge-red">LIVE</span>
            <button class="fav-btn ${isFav ? 'active' : ''}" data-favorite-index="${index}" aria-label="Toggle favorite">★</button>
          </div>
        </div>
        <div class="channel-info">
          <h3 class="channel-name" title="${escapeHtml(ch.name)}">${escapeHtml(ch.name)}</h3>
          <span class="channel-category">${escapeHtml(ch.category)} • ${escapeHtml(ch.quality || 'HD')}</span>
        </div>
        <div class="epg-info">
          <div class="epg-now">▶ ${escapeHtml(nowTitle)}</div>
          <div class="epg-progress-bar"><div class="epg-progress-fill" style="width: ${progress}%;"></div></div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll("[data-channel-index]").forEach(card => {
    const openChannel = () => {
      const channel = paged[Number(card.dataset.channelIndex)];
      if (channel) window.openVideoPlayer({
        title: channel.name, epg: channel.epg?.now?.title || "Live Stream",
        logo: channel.logo, streamUrl: channel.streamUrl, directUrl: channel.directUrl || "",
        channelId: channel.id, stream_id: channel.stream_id || ""
      });
    };
    card.addEventListener("click", event => {
      if (!event.target.closest("[data-favorite-index]")) openChannel();
    });
    card.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && !event.target.closest("[data-favorite-index]")) {
        event.preventDefault();
        openChannel();
      }
    });
  });
  grid.querySelectorAll("[data-favorite-index]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const channel = paged[Number(button.dataset.favoriteIndex)];
      if (channel) window.toggleFavorite(channel.id);
    });
  });

  if (filtered.length > paged.length) {
    const paginationHtml = `
      <div class="pagination-wrap">
        <div class="channel-count-info">Showing ${paged.length.toLocaleString()} of ${filtered.length.toLocaleString()} channels</div>
        <button class="btn-primary" style="padding: 10px 24px; font-weight: 700; border-radius: var(--radius-full);" onclick="window.loadMoreChannels()">
          Load More Channels (+60)
        </button>
      </div>
    `;
    grid.insertAdjacentHTML("beforeend", paginationHtml);
  }
}

window.loadMoreChannels = function() {
  const s = window.GPTR_APP.state;
  s.liveCurrentPage = (s.liveCurrentPage || 1) + 1;
  renderLiveChannels(s.activeCategory, document.getElementById("globalSearch")?.value || "");
};

window.selectCategoryDropdown = function(cat) {
  const s = window.GPTR_APP.state;
  s.liveCurrentPage = 1;

  // A previous global search can remain active while the user changes tabs.
  // Clear it so selecting a category shows that category's full channel list.
  const globalSearch = document.getElementById("globalSearch");
  if (globalSearch) globalSearch.value = "";

  renderLiveChannels(cat, "");
};

window.renderMovieCategoryChipsList = function(categories, activeCat, queryFilter = "") {
  const chips = document.getElementById("movieCategoryChips");
  if (!chips) return;
  const s = window.GPTR_APP.state;

  let displayCats = categories;
  if (queryFilter && queryFilter.trim()) {
    const q = queryFilter.toLowerCase().trim();
    displayCats = categories.filter(c => c === "All" || c === activeCat || c.toLowerCase().includes(q));
  }

  chips.innerHTML = displayCats.map(cat => {
    const count = cat === "All" ? s.movies.length : s.movies.filter(m => m.genre === cat).length;
    return `
      <button class="chip ${cat === activeCat ? 'active' : ''}" onclick="window.selectMovieCategory('${escapeQuotes(cat)}')">
        ${cat} <span class="chip-count">${count > 0 ? count : ''}</span>
      </button>
    `;
  }).join("");
};

window.filterMovieCategoryChips = function(query) {
  const s = window.GPTR_APP.state;
  const rawCats = (s.vodCategories && s.vodCategories.length > 0)
    ? s.vodCategories.map(c => c.category_name)
    : [...new Set(s.movies.map(m => m.genre).filter(Boolean))];
  const genres = ["All", ...rawCats];
  window.renderMovieCategoryChipsList(genres, s.activeMovieGenre || "All", query);
};

function renderMovies(filterGenre = "All") {
  const s = window.GPTR_APP.state;
  s.activeMovieGenre = filterGenre;

  const rawCats = (s.vodCategories && s.vodCategories.length > 0)
    ? s.vodCategories.map(c => c.category_name)
    : [...new Set(s.movies.map(m => m.genre).filter(Boolean))];
  const genres = ["All", ...rawCats];

  const dropdown = document.getElementById("movieCategoryDropdown");
  if (dropdown) {
    dropdown.innerHTML = genres.map(g => {
      const count = g === "All" ? s.movies.length : s.movies.filter(m => m.genre === g).length;
      return `<option value="${escapeQuotes(g)}" ${g === filterGenre ? 'selected' : ''}>${g} ${count > 0 ? '(' + count + ')' : ''}</option>`;
    }).join("");
  }

  const filterInput = document.getElementById("movieCategoryFilterInput");
  window.renderMovieCategoryChipsList(genres, filterGenre, filterInput ? filterInput.value : "");

  const totalDisplay = document.getElementById("movieTotalDisplay");
  if (totalDisplay) {
    const totalCount = s.vodCategories ? s.vodCategories.length : 0;
    totalDisplay.textContent = `${totalCount} Movie Categories • ${s.movies.length} Movies Loaded`;
  }

  let filtered = s.movies;
  if (filterGenre !== "All") {
    filtered = filtered.filter(m => m.genre === filterGenre || m.categoryId === filterGenre);
  }

  const grid = document.getElementById("movieGrid");
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        ${s.vodCategories?.length ? "No movies are loaded in this category yet. Select a category to fetch its catalogue." : "Movie categories are unavailable. Check your provider connection and try again."}
      </div>
    `;
    return;
  }

  renderMediaCards(grid, filtered, "movie");
}

window.selectMovieCategory = async function(cat) {
  const s = window.GPTR_APP.state;
  s.activeMovieGenre = cat;
  if (cat === "All") {
    renderMovies("All");
    return;
  }

  const category = (s.vodCategories || []).find(item => item.category_name === cat);
  if (!category || category.category_id == null) {
    renderMovies(cat);
    return;
  }

  if (!(s.loadedMovieCategories instanceof Set)) s.loadedMovieCategories = new Set();
  const categoryId = String(category.category_id);
  if (!s.loadedMovieCategories.has(categoryId)) {
    const grid = document.getElementById("movieGrid");
    if (grid) grid.innerHTML = '<p class="empty-state">Loading movies from your provider…</p>';
    try {
      const response = await fetch(`/api/catalog/vod-streams?category_id=${encodeURIComponent(categoryId)}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Movie request failed (${response.status}).`);
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error("Invalid movie catalogue response.");
      const formatted = items.filter(item => item && item.stream_id != null).map(item => {
        const extension = /^[a-z0-9]{2,5}$/i.test(String(item.container_extension || "")) ? item.container_extension : "mp4";
        const poster = safeMediaImageUrl(item.stream_icon);
        return {
          id: "vod_" + item.stream_id,
          stream_id: item.stream_id,
          title: item.name || "Untitled movie",
          genre: category.category_name,
          categoryId,
          year: (String(item.name || "").match(/\((\d{4})\)/) || [])[1] || "",
          rating: item.rating || "N/A",
          poster,
          backdrop: poster,
          streamUrl: `/stream/movie/${encodeURIComponent(item.stream_id)}.${extension}`,
          synopsis: item.plot || item.description || "",
          description: item.plot || item.description || "",
          quality: /4K/i.test(item.name || "") ? "4K" : (/FHD/i.test(item.name || "") ? "FHD" : ""),
          duration: item.duration || (Number(item.duration_secs) > 0 ? formatTime(Number(item.duration_secs)) : "")
        };
      });
      const existingIds = new Set(s.movies.map(item => item.id));
      formatted.forEach(item => {
        if (!existingIds.has(item.id)) {
          s.movies.push(item);
          existingIds.add(item.id);
        }
      });
      s.loadedMovieCategories.add(categoryId);
    } catch (error) {
      console.warn("[CATALOG] Movie category unavailable:", error);
      if (grid) grid.innerHTML = '<p class="empty-state">Movies could not be loaded from the provider. Please try again later.</p>';
      return;
    }
  }

  renderMovies(cat);
};

window.filterSeriesCategoryChips = function(query) {
  const s = window.GPTR_APP.state;
  const rawCats = (s.seriesCategories && s.seriesCategories.length > 0)
    ? s.seriesCategories.map(c => c.category_name)
    : [...new Set(s.series.map(ser => ser.genre).filter(Boolean))];
  const genres = ["All", ...rawCats];
  window.renderSeriesCategoryChipsList(genres, s.activeSeriesGenre || "All", query);
};

function renderSeries(filterGenre = "All") {
  const s = window.GPTR_APP.state;
  s.activeSeriesGenre = filterGenre;

  const rawCats = (s.seriesCategories && s.seriesCategories.length > 0)
    ? s.seriesCategories.map(c => c.category_name)
    : [...new Set(s.series.map(ser => ser.genre).filter(Boolean))];
  const genres = ["All", ...rawCats];

  const dropdown = document.getElementById("seriesCategoryDropdown");
  if (dropdown) {
    dropdown.innerHTML = genres.map(g => {
      const count = g === "All" ? s.series.length : s.series.filter(ser => ser.genre === g).length;
      return `<option value="${escapeQuotes(g)}" ${g === filterGenre ? 'selected' : ''}>${g} ${count > 0 ? '(' + count + ')' : ''}</option>`;
    }).join("");
  }

  const filterInput = document.getElementById("seriesCategoryFilterInput");
  window.renderSeriesCategoryChipsList(genres, filterGenre, filterInput ? filterInput.value : "");

  const totalDisplay = document.getElementById("seriesTotalDisplay");
  if (totalDisplay) {
    const totalCount = s.seriesCategories ? s.seriesCategories.length : 0;
    totalDisplay.textContent = `${totalCount} TV Series Categories • ${s.series.length} Shows Loaded`;
  }

  let filtered = s.series;
  if (filterGenre !== "All") {
    filtered = filtered.filter(ser => ser.genre === filterGenre || ser.categoryId === filterGenre);
  }

  const grid = document.getElementById("seriesGrid");
  if (!grid) return;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        ${s.seriesCategories?.length ? "No series are loaded in this category yet. Select a category to fetch its catalogue." : "Series categories are unavailable. Check your provider connection and try again."}
      </div>
    `;
    return;
  }

  renderMediaCards(grid, filtered, "series");
}

window.selectSeriesCategory = async function(cat) {
  const s = window.GPTR_APP.state;
  s.activeSeriesGenre = cat;
  if (cat === "All") {
    renderSeries("All");
    return;
  }

  const category = (s.seriesCategories || []).find(item => item.category_name === cat);
  if (!category || category.category_id == null) {
    renderSeries(cat);
    return;
  }

  if (!(s.loadedSeriesCategories instanceof Set)) s.loadedSeriesCategories = new Set();
  const categoryId = String(category.category_id);
  if (!s.loadedSeriesCategories.has(categoryId)) {
    const grid = document.getElementById("seriesGrid");
    if (grid) grid.innerHTML = '<p class="empty-state">Loading series from your provider…</p>';
    try {
      const response = await fetch(`/api/catalog/series?category_id=${encodeURIComponent(categoryId)}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Series request failed (${response.status}).`);
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error("Invalid series catalogue response.");
      const formatted = items.filter(item => item && item.series_id != null).map(item => {
        const poster = safeMediaImageUrl(item.cover);
        return {
          id: "ser_" + item.series_id,
          series_id: item.series_id,
          title: item.name || "Untitled series",
          genre: category.category_name,
          categoryId,
          seasonsCount: item.seasons_count || item.seasonsCount || null,
          rating: item.rating || "N/A",
          poster,
          backdrop: poster,
          synopsis: item.plot || item.description || "",
          description: item.plot || item.description || ""
        };
      });
      const existingIds = new Set(s.series.map(item => item.id));
      formatted.forEach(item => {
        if (!existingIds.has(item.id)) {
          s.series.push(item);
          existingIds.add(item.id);
        }
      });
      s.loadedSeriesCategories.add(categoryId);
    } catch (error) {
      console.warn("[CATALOG] Series category unavailable:", error);
      if (grid) grid.innerHTML = '<p class="empty-state">Series could not be loaded from the provider. Please try again later.</p>';
      return;
    }
  }

  renderSeries(cat);
};

function renderCricketSection() {
  const container = document.getElementById("cricketCardContainer");
  if (!container) return;
  const channels = window.GPTR_APP.state.channels || [];
  const sportsChannels = channels.filter(channel =>
    /sport|cricket|football|soccer|tennis|motorsport|racing|golf|basketball|rugby|hockey|fight|wrestling/i
      .test(`${channel.category || ""} ${channel.name || ""}`)
  );

  if (sportsChannels.length === 0) {
    container.innerHTML = '<p class="empty-state">No sports channels were found in your connected provider catalogue.</p>';
    return;
  }

  container.innerHTML = `
    <div class="media-grid">
      ${sportsChannels.map((channel, index) => `
        <button type="button" class="channel-card" data-sports-channel-index="${index}" style="text-align:left;border:0;color:inherit;">
          <div class="channel-card-top">
            <div class="channel-logo-wrap"><img class="channel-logo" src="${escapeHtml(safeMediaImageUrl(channel.logo))}" alt="${escapeHtml(channel.name)}" loading="lazy"></div>
            <span class="badge badge-red">LIVE CHANNEL</span>
          </div>
          <div class="channel-info">
            <h3 class="channel-name">${escapeHtml(channel.name)}</h3>
            <span class="channel-category">${escapeHtml(channel.category || "Sports")}</span>
          </div>
        </button>
      `).join("")}
    </div>
  `;

  container.querySelectorAll("[data-sports-channel-index]").forEach(card => {
    card.addEventListener("click", () => {
      const channel = sportsChannels[Number(card.dataset.sportsChannelIndex)];
      if (!channel) return;
      window.openVideoPlayer({
        title: channel.name,
        epg: channel.category || "Sports",
        logo: safeMediaImageUrl(channel.logo),
        streamUrl: channel.streamUrl,
        channelId: channel.id,
        stream_id: channel.stream_id || ""
      });
    });
  });
}

function renderBiggBoss() {
  const bb = window.GPTR_DATA.bigboss;
  const grid = document.getElementById("multicamGrid");
  if (!grid) return;
  if (!bb || !Array.isArray(bb.feeds) || bb.feeds.length === 0) {
    grid.innerHTML = '<p class="empty-state">No verified Bigg Boss feeds are currently available.</p>';
    return;
  }

  grid.innerHTML = bb.feeds.map((feed, index) => `
    <div class="multicam-feed" data-bigg-boss-feed-index="${index}" role="button" tabindex="0">
      <div class="multicam-thumb-wrap">
        <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=70" alt="${escapeHtml(feed.name)}">
        <div class="cam-badge">🔴 ${escapeHtml(feed.camera)}</div>
        <div class="play-circle" style="position: absolute;">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="multicam-feed-info">
        <div>
          <strong>${escapeHtml(feed.name)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(bb.season)} • 24x7 Live Feed</div>
        </div>
        <span class="badge badge-red">LIVE</span>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll("[data-bigg-boss-feed-index]").forEach(item => {
    const openFeed = () => {
      const feed = bb.feeds[Number(item.dataset.biggBossFeedIndex)];
      if (!feed || typeof feed.streamUrl !== "string" || !feed.streamUrl.trim()) return;
      window.openVideoPlayer({
        title: `Bigg Boss 24/7 - ${feed.name}`,
        epg: `${bb.season} Live Feed`,
        logo: "img/logo.png",
        streamUrl: feed.streamUrl
      });
    };
    item.addEventListener("click", openFeed);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFeed();
      }
    });
  });
}

function renderMusicSection() {
  const songs = Array.isArray(window.GPTR_DATA.music?.trending) ? window.GPTR_DATA.music.trending : [];
  const list = document.getElementById("songList");
  if (!list) return;
  if (songs.length === 0) {
    list.innerHTML = '<p class="empty-state">No verified music streams are currently available.</p>';
    const lyrics = document.getElementById("lyricsScroll");
    if (lyrics) lyrics.textContent = "Lyrics will appear when a verified track is available.";
    return;
  }

  list.innerHTML = songs.map((s, i) => `
    <div class="song-item ${s.id === window.GPTR_APP.state.currentTrack?.id ? 'active' : ''}" onclick="playTrack(window.GPTR_DATA.music.trending[${i}])">
      <div class="song-left">
        <img class="song-cover" src="${s.cover}" alt="${s.title}">
        <div>
          <div class="song-title">${s.title}</div>
          <div class="song-artist">${s.artist} • ${s.album}</div>
        </div>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted);">${s.duration}</div>
    </div>
  `).join("");

  renderLyrics();
}

function playTrack(track) {
  const s = window.GPTR_APP.state;
  s.currentTrack = track;

  const title = document.getElementById("musicTitle");
  const artist = document.getElementById("musicArtist");
  const thumb = document.getElementById("musicThumb");
  const btn = document.getElementById("musicPlayBtn");

  if (title) title.textContent = track.title;
  if (artist) artist.textContent = track.artist;
  if (thumb) thumb.src = track.cover;

  s.audioElement.src = track.audioUrl;
  s.audioElement.play().then(() => {
    s.isPlayingMusic = true;
    if (btn) btn.textContent = "⏸";
  }).catch(e => console.log(e));

  renderMusicSection();
}

function renderLyrics() {
  const s = window.GPTR_APP.state;
  const scroll = document.getElementById("lyricsScroll");
  if (!scroll || !Array.isArray(s.currentTrack?.lyrics)) return;

  scroll.innerHTML = s.currentTrack.lyrics.map((line, index) => `
    <div class="lyrics-line ${index === s.currentLyricIndex ? 'active' : ''}" data-lyric-index="${index}" role="button" tabindex="0">
      ${escapeHtml(line.text)}
    </div>
  `).join("");

  scroll.querySelectorAll("[data-lyric-index]").forEach(item => {
    const seekToLyric = () => {
      const line = s.currentTrack?.lyrics?.[Number(item.dataset.lyricIndex)];
      const time = Number(line?.time);
      if (!Number.isFinite(time) || time < 0 || !s.audioElement) return;
      s.audioElement.currentTime = time;
    };
    item.addEventListener("click", seekToLyric);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        seekToLyric();
      }
    });
  });
}

function renderChannelDrawer() {
  const s = window.GPTR_APP.state;
  const drawer = document.getElementById("drawerList");
  if (!drawer) return;

  drawer.innerHTML = s.channels.map((ch, idx) => `
    <div class="drawer-item ${idx === s.currentChannelIndex ? 'active' : ''}" data-drawer-channel-index="${idx}" tabindex="0" role="button">
      <img class="drawer-thumb" src="${escapeHtml(safeMediaImageUrl(ch.logo))}" alt="${escapeHtml(ch.name)}" onerror="this.onerror=null;this.src='img/logo.png'">
      <div>
        <div style="font-weight: 700; font-size: 0.9rem;">${escapeHtml(ch.name)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(ch.category)}</div>
      </div>
    </div>
  `).join("");

  drawer.querySelectorAll("[data-drawer-channel-index]").forEach(item => {
    const openChannel = () => {
      const index = Number(item.dataset.drawerChannelIndex);
      const channel = s.channels[index];
      if (!channel) return;
      s.currentChannelIndex = index;
      window.openVideoPlayer({
        title: channel.name,
        epg: channel.category,
        logo: safeMediaImageUrl(channel.logo),
        streamUrl: channel.streamUrl,
        channelId: channel.id,
        stream_id: channel.stream_id || ""
      });
    };
    item.addEventListener("click", openChannel);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openChannel();
      }
    });
  });
}

let osdTimeout = null;
function showOSD() {
  const osd = document.querySelector(".video-osd");
  if (!osd) return;
  osd.classList.remove("hidden");
  clearTimeout(osdTimeout);
  osdTimeout = setTimeout(() => {
    const video = document.getElementById("mainVideoPlayer");
    const drawer = document.getElementById("channelDrawer");
    if (video && !video.paused && drawer && !drawer.classList.contains("open")) {
      osd.classList.add("hidden");
    }
  }, 4000);
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const s = window.GPTR_APP.state;

  // Apply Theme
  if (s.theme !== "default") {
    document.documentElement.setAttribute("data-theme", s.theme);
  }

  // Clock
  function tickClock() {
    const clock = document.getElementById("clockDisplay");
    if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  tickClock();
  setInterval(tickClock, 1000);

  // Setup Sidebar and Top Tabs Click handlers
  document.querySelectorAll(".nav-item, .top-tab-item").forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      if (tab) window.switchTab(tab);
    });
  });

  // Mobile Menu: one state setter keeps the drawer, backdrop and scroll lock in sync.
  const mobileSidebar = document.querySelector(".sidebar");
  const mobileMenuToggle = document.getElementById("menuToggle");
  window.setMobileSidebarOpen = function(isOpen) {
    if (!mobileSidebar || !mobileMenuToggle) return;
    const open = Boolean(isOpen);
    mobileSidebar.classList.toggle("open", open);
    document.body.classList.toggle("mobile-menu-open", open);
    mobileMenuToggle.setAttribute("aria-expanded", String(open));
  };
  mobileMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    window.setMobileSidebarOpen(!mobileSidebar?.classList.contains("open"));
  });
  // The CSS backdrop intercepts outside taps, preventing accidental activation
  // of controls underneath while the drawer is open.
  document.addEventListener("click", (event) => {
    if (!mobileSidebar?.classList.contains("open")) return;
    if (mobileSidebar.contains(event.target) || mobileMenuToggle?.contains(event.target)) return;
    window.setMobileSidebarOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !mobileSidebar?.classList.contains("open")) return;
    window.setMobileSidebarOpen(false);
    mobileMenuToggle?.focus();
  });

  // Hero Dots
  document.querySelectorAll(".hero-dots .dot").forEach((dot, idx) => {
    dot.addEventListener("click", () => {
      document.querySelectorAll(".hero-slide").forEach((sl, i) => sl.classList.toggle("active", i === idx));
      document.querySelectorAll(".hero-dots .dot").forEach((d, i) => d.classList.toggle("active", i === idx));
    });
  });

  // Hero Play buttons
  document.querySelectorAll(".btn-hero-play").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const feat = window.GPTR_DATA.featured.find(f => f.id === id);
      if (feat) {
        window.openVideoPlayer({
          title: feat.title,
          epg: `${feat.category} • ${feat.year}`,
          logo: feat.poster,
          streamUrl: feat.streamUrl
        });
      }
    });
  });

  // Touch and pointer interaction reliably reveals the player controls.
  const playerContainer = document.querySelector(".video-container");
  const revealPlayerControls = () => showOSD();
  playerContainer?.addEventListener("pointermove", revealPlayerControls, { passive: true });
  playerContainer?.addEventListener("pointerdown", revealPlayerControls, { passive: true });
  playerContainer?.addEventListener("touchstart", revealPlayerControls, { passive: true });
  video?.addEventListener("play", revealPlayerControls);
  video?.addEventListener("pause", revealPlayerControls);

  // Video Player OSD buttons
  const video = document.getElementById("mainVideoPlayer");
  const playBtn = document.getElementById("osdPlayBtn");
  const closeBtn = document.getElementById("osdCloseBtn");
  const toggleDrawerBtn = document.getElementById("toggleDrawerBtn");
  const closeDrawerBtn = document.getElementById("closeDrawerBtn");
  const aspectBtn = document.getElementById("osdAspectBtn");
  const pipBtn = document.getElementById("osdPipBtn");
  const fsBtn = document.getElementById("osdFullscreenBtn");

  playBtn?.addEventListener("click", () => {
    if (video.paused) video.play();
    else video.pause();
  });

  video?.addEventListener("play", () => { if (playBtn) playBtn.textContent = "⏸ Pause"; });
  video?.addEventListener("pause", () => { if (playBtn) playBtn.textContent = "▶ Play"; });

  video?.addEventListener("timeupdate", () => {
    const bar = document.getElementById("osdProgressBar");
    const timeDisp = document.getElementById("osdTimeDisplay");
    if (!isNaN(video.duration)) {
      if (bar) bar.value = (video.currentTime / video.duration) * 100;
      if (timeDisp) timeDisp.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    } else {
      if (timeDisp) timeDisp.textContent = "LIVE";
    }
  });

  document.getElementById("osdProgressBar")?.addEventListener("input", (e) => {
    if (!isNaN(video.duration)) video.currentTime = (e.target.value / 100) * video.duration;
  });

  document.getElementById("osdVolumeSlider")?.addEventListener("input", (e) => {
    video.volume = e.target.value;
  });

  aspectBtn?.addEventListener("click", () => {
    s.aspectRatioIndex = (s.aspectRatioIndex + 1) % s.aspectRatios.length;
    const mode = s.aspectRatios[s.aspectRatioIndex];
    video.style.objectFit = mode;
    aspectBtn.textContent = `Ratio: ${mode.toUpperCase()}`;
  });

  // Support standard Picture-in-Picture and Safari's native video presentation mode.
  const togglePlayerPiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        if (typeof document.exitPictureInPicture === "function") {
          await document.exitPictureInPicture();
        }
        return;
      }

      if (video.webkitPresentationMode && typeof video.webkitSetPresentationMode === "function") {
        const nextMode = video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        video.webkitSetPresentationMode(nextMode);
        return;
      }

      if (video.disablePictureInPicture) {
        console.info("[Player] Picture-in-Picture is disabled for this video.");
        return;
      }

      if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
        return;
      }

      console.info("[Player] Picture-in-Picture is not supported by this browser.");
    } catch (error) {
      console.warn("[Player] Picture-in-Picture request failed:", error);
    }
  };

  pipBtn?.addEventListener("click", togglePlayerPiP);

  // Use the standard Fullscreen API where available, with Safari/iOS video fallback.
  const togglePlayerFullscreen = async () => {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        try { await document.exitFullscreen(); }
        catch (error) { console.warn("[Player] Could not exit fullscreen:", error); }
      }
      return;
    }

    // iPhone Safari exposes native fullscreen on the video element rather than the page.
    if (typeof video.webkitEnterFullscreen === "function" && !document.fullscreenEnabled) {
      try { video.webkitEnterFullscreen(); }
      catch (error) { console.warn("[Player] Native video fullscreen unavailable:", error); }
      return;
    }

    const fullscreenTarget = document.getElementById("videoPlayerModal") || video;
    if (typeof fullscreenTarget.requestFullscreen === "function") {
      try { await fullscreenTarget.requestFullscreen(); }
      catch (error) {
        console.warn("[Player] Fullscreen request was rejected:", error);
        if (typeof video.webkitEnterFullscreen === "function") {
          try { video.webkitEnterFullscreen(); }
          catch (fallbackError) { console.warn("[Player] Native fullscreen fallback failed:", fallbackError); }
        }
      }
    } else if (typeof video.webkitEnterFullscreen === "function") {
      try { video.webkitEnterFullscreen(); }
      catch (error) { console.warn("[Player] Native video fullscreen unavailable:", error); }
    }
  };

  fsBtn?.addEventListener("click", togglePlayerFullscreen);

  closeBtn?.addEventListener("click", window.closeVideoPlayer);
  toggleDrawerBtn?.addEventListener("click", () => document.getElementById("channelDrawer")?.classList.toggle("open"));
  closeDrawerBtn?.addEventListener("click", () => document.getElementById("channelDrawer")?.classList.remove("open"));

  // Music Player Events
  s.audioElement.addEventListener("timeupdate", () => {
    const cur = s.audioElement.currentTime;
    const dur = s.audioElement.duration || 1;
    const prog = document.getElementById("musicProgress");
    const tCur = document.getElementById("musicTimeCurrent");
    const tTot = document.getElementById("musicTimeTotal");

    if (prog) prog.value = (cur / dur) * 100;
    if (tCur) tCur.textContent = formatTime(cur);
    if (tTot) tTot.textContent = formatTime(dur);

    // Lyrics sync
    if (s.currentTrack?.lyrics) {
      const lyrics = s.currentTrack.lyrics;
      let activeIdx = 0;
      for (let i = 0; i < lyrics.length; i++) {
        if (cur >= lyrics[i].time) activeIdx = i;
      }
      if (activeIdx !== s.currentLyricIndex) {
        s.currentLyricIndex = activeIdx;
        const lines = document.getElementById("lyricsScroll")?.querySelectorAll(".lyrics-line");
        if (lines) {
          lines.forEach((l, idx) => {
            l.classList.toggle("active", idx === activeIdx);
            if (idx === activeIdx) l.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
      }
    }
  });

  document.getElementById("musicPlayBtn")?.addEventListener("click", () => {
    if (s.isPlayingMusic) {
      s.audioElement.pause();
      s.isPlayingMusic = false;
      document.getElementById("musicPlayBtn").textContent = "▶";
    } else {
      s.audioElement.play();
      s.isPlayingMusic = true;
      document.getElementById("musicPlayBtn").textContent = "⏸";
    }
  });

  // Keyboard Shortcuts (TV Remote support)
  window.addEventListener("keydown", (e) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    const playerModal = document.getElementById("videoPlayerModal");
    if (playerModal && playerModal.classList.contains("active")) {
      switch (e.key) {
        case "Escape":
        case "Backspace":
          window.closeVideoPlayer();
          break;
        case " ":
        case "Enter":
          if (video.paused) video.play();
          else video.pause();
          showOSD();
          break;
        case "ArrowUp":
          e.preventDefault();
          s.currentChannelIndex = (s.currentChannelIndex - 1 + s.channels.length) % s.channels.length;
          const prevCh = s.channels[s.currentChannelIndex];
          window.openVideoPlayer({ title: prevCh.name, epg: prevCh.category, logo: prevCh.logo, streamUrl: prevCh.streamUrl, channelId: prevCh.id });
          break;
        case "ArrowDown":
          e.preventDefault();
          s.currentChannelIndex = (s.currentChannelIndex + 1) % s.channels.length;
          const nextCh = s.channels[s.currentChannelIndex];
          window.openVideoPlayer({ title: nextCh.name, epg: nextCh.category, logo: nextCh.logo, streamUrl: nextCh.streamUrl, channelId: nextCh.id });
          break;
        case "ArrowLeft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showOSD();
          break;
        case "ArrowRight":
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 99999, video.currentTime + 10);
          showOSD();
          break;
        case "f":
        case "F":
          togglePlayerFullscreen();
          break;
        case "m":
        case "M":
          video.muted = !video.muted;
          showOSD();
          break;
      }
    } else {
      if (e.key === "Escape") window.closeDetailModal();
    }
  });

  // Global Search
  document.getElementById("globalSearch")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (s.currentTab === "live") renderLiveChannels(s.activeCategory, q);
    else if (s.currentTab === "movies") {
      let filtered = s.movies.filter(m =>
        String(m.title || "").toLowerCase().includes(q) ||
        String(m.genre || "").toLowerCase().includes(q)
      );
      const grid = document.getElementById("movieGrid");
      if (grid) renderMediaCards(grid, filtered, "movie");
    }
  });

  // Initial Renders
  // Catalogue categories are loaded only after provider authentication.

  renderHomeView();
  renderLiveChannels();
  renderMovies();
  renderSeries();
  renderAccessCodes();

  // Access Code Button Listeners
  document.getElementById("btnActivateCode")?.addEventListener("click", () => {
    const val = document.getElementById("accessCodeInput")?.value;
    window.activateAccessCode(val, "codeStatusMsg");
  });

  document.getElementById("btnModalActivateCode")?.addEventListener("click", () => {
    const val = document.getElementById("modalAccessCodeInput")?.value;
    window.activateAccessCode(val, "modalCodeStatusMsg");
  });
});

window.openAccessCodeModal = function() {
  document.getElementById("accessCodeModal")?.classList.add("active");
  document.getElementById("modalAccessCodeInput")?.focus();
};

window.closeAccessCodeModal = function() {
  document.getElementById("accessCodeModal")?.classList.remove("active");
};

window.loadUnlockedCatalog = async function(session, code, allowAuthRefresh = true) {
  const s = window.GPTR_APP.state;
  s.isLoadingCatalog = true;
  s.channels = [];
  s.movies = [];
  s.series = [];
  s.vodCategories = [];
  s.seriesCategories = [];
  s.loadedMovieCategories = new Set();
  s.loadedSeriesCategories = new Set();
  renderLiveBanner();

  const fetchJson = async (path) => {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Catalogue request failed (${response.status}).`);
    return response.json();
  };

  try {
    let liveCategories;
    try {
      const response = await fetch("/api/catalog/live-categories", { credentials: "same-origin" });
      if (response.status === 401 && allowAuthRefresh && code) {
        const authRes = await fetch("/api/iptv/validate-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code })
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.success) {
            const { xtreamUsername, xtreamPassword, ...safeSession } = authData;
            s.activeCode = code;
            s.session = safeSession;
            localStorage.setItem("gptrtv_active_code", code);
            localStorage.setItem("gptrtv_session", JSON.stringify(safeSession));
            return await window.loadUnlockedCatalog(safeSession, code, false);
          }
        }
        s.activeCode = null;
        s.session = null;
        localStorage.removeItem("gptrtv_active_code");
        localStorage.removeItem("gptrtv_session");
        throw new Error("Your session expired. Please enter your access code again.");
      }
      if (!response.ok) throw new Error(`Live categories unavailable (${response.status}).`);
      liveCategories = await response.json();
      if (!Array.isArray(liveCategories)) throw new Error("Invalid live category response.");
      s.liveCategories = liveCategories;
    } catch (error) {
      if (error.message === "Your session expired. Please enter your access code again.") throw error;
      console.warn("[CATALOG] Live categories unavailable:", error);
      liveCategories = [];
    }

    const liveCategoryNames = new Map(
      liveCategories.map(category => [String(category.category_id), category.category_name])
    );

    try {
      const streams = await fetchJson("/api/catalog/live-streams");
      if (!Array.isArray(streams)) throw new Error("Invalid live stream response.");
      s.channels = streams.filter(item => item && item.stream_id != null).map(item => ({
        id: "xtream_" + item.stream_id,
        stream_id: item.stream_id,
        num: item.num,
        name: item.name || "Unnamed channel",
        category: liveCategoryNames.get(String(item.category_id)) || "Uncategorised",
        categoryId: item.category_id,
        logo: safeMediaImageUrl(item.stream_icon),
        streamUrl: `/stream/live/${encodeURIComponent(item.stream_id)}.m3u8`,
        directUrl: `/stream/live/${encodeURIComponent(item.stream_id)}.m3u8`,
        quality: /4K/i.test(item.name || "") ? "4K" : (/FHD/i.test(item.name || "") ? "FHD" : "HD"),
        epg: null
      }));
      s.unlockedChannelsCount = s.channels.length;
    } catch (error) {
      console.warn("[CATALOG] Live streams unavailable:", error);
    }

    try {
      const [vodCategories, seriesCategories] = await Promise.all([
        fetchJson("/api/catalog/vod-categories"),
        fetchJson("/api/catalog/series-categories")
      ]);
      s.vodCategories = Array.isArray(vodCategories) ? vodCategories : [];
      s.seriesCategories = Array.isArray(seriesCategories) ? seriesCategories : [];
    } catch (error) {
      console.warn("[CATALOG] VOD/series categories unavailable:", error);
    }

    updateDOMBadges();
    renderLiveChannels("All");
    renderMovies();
    renderSeries();
    renderHomeView();

    // Load one real category from each catalogue to make the first screen useful.
    const firstMovieCategory = s.vodCategories.find(category => category?.category_id != null);
    const firstSeriesCategory = s.seriesCategories.find(category => category?.category_id != null);
    await Promise.all([
      firstMovieCategory ? window.selectMovieCategory(firstMovieCategory.category_name) : Promise.resolve(),
      firstSeriesCategory ? window.selectSeriesCategory(firstSeriesCategory.category_name) : Promise.resolve()
    ]);
  } catch (error) {
    console.error("[CATALOG] Load failed:", error);
    if (error.message === "Your session expired. Please enter your access code again.") {
      const status = document.getElementById("codeStatusMsg");
      if (status) status.textContent = error.message;
    }
  } finally {
    s.isLoadingCatalog = false;
    updateDOMBadges();
    renderLiveBanner();
    renderLiveChannels(s.activeCategory || "All");
    renderHomeView();
    renderMovies(s.activeMovieGenre || "All");
    renderSeries(s.activeSeriesGenre || "All");
    renderAccessCodes();
  }
};

window.activateAccessCode = async function(inputVal, statusElId) {
  const code = (inputVal || "").trim().toUpperCase();
  const statusEl = document.getElementById(statusElId);
  if (!code) {
    if (statusEl) {
      statusEl.style.color = "#EF4444";
      statusEl.textContent = "Please enter an access code.";
    }
    return;
  }

  if (statusEl) {
    statusEl.style.color = "#38BDF8";
    statusEl.textContent = `Validating code "${code}" with GPTR server...`;
  }

  try {
    const res = await fetch("/api/iptv/validate-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error || "Invalid code. Please check and try again.";
      if (statusEl) {
        statusEl.style.color = "#EF4444";
        statusEl.textContent = `✗ ${errMsg}`;
      }
      return; // DO NOT UNLOCK!
    }

    const data = await res.json();
    console.log("Access code validated successfully.");

    if (!data.success) {
      if (statusEl) {
        statusEl.style.color = "#EF4444";
        statusEl.textContent = "✗ Invalid code response from server.";
      }
      return;
    }

    const s = window.GPTR_APP.state;
    const { xtreamUsername, xtreamPassword, ...safeSession } = data;
    s.activeCode = code;
    s.session = safeSession;
    localStorage.setItem("gptrtv_active_code", code);
    localStorage.setItem("gptrtv_session", JSON.stringify(safeSession));

    const newCodeEntry = {
      code: code,
      name: data.name || "Subscriber",
      provider: data.provider || "Connected provider",
      activatedAt: new Date().toLocaleDateString(),
      expiresAt: data.exp_date || data.expiry || "Not supplied by provider",
      status: "ACTIVE",
      unlockedChannels: null,
      server: "Protected server connection"
    };

    s.accessCodes = [newCodeEntry, ...s.accessCodes.filter(c => c.code !== code)];
    localStorage.setItem("gptrtv_access_codes", JSON.stringify(s.accessCodes));

    if (statusEl) {
      statusEl.style.color = "#10B981";
      statusEl.textContent = `✓ Code verified! Welcome, ${data.name || "subscriber"}. Loading your provider catalogue...`;
    }

    // Unlock full library
    await window.loadUnlockedCatalog(data, code);

    setTimeout(() => {
      window.closeAccessCodeModal();
      if (statusEl) statusEl.textContent = "";
      // Immediately switch to Live TV tab so the user sees all the channels!
      window.switchTab("live");
    }, 1200);

  } catch (err) {
    console.error("Auth error:", err);
    if (statusEl) {
      statusEl.style.color = "#EF4444";
      statusEl.textContent = `✗ Connection error: ${err.message}`;
    }
  }
};

window.removeAccessCode = function(code) {
  const s = window.GPTR_APP.state;
  s.accessCodes = s.accessCodes.filter(c => c.code !== code);
  localStorage.setItem("gptrtv_access_codes", JSON.stringify(s.accessCodes));
  if (s.activeCode === code) {
    s.activeCode = null;
    s.session = null;
    localStorage.removeItem("gptrtv_active_code");
    localStorage.removeItem("gptrtv_session");
    s.channels = [...(window.GPTR_DATA?.channels || [])];
    s.movies = [...(window.GPTR_DATA?.movies || [])];
    s.series = [...(window.GPTR_DATA?.series || [])];
    renderLiveBanner();
    updateDOMBadges();
    renderLiveChannels("All");
    renderHomeView();
  }
  renderAccessCodes();
};

function renderAccessCodes() {
  const s = window.GPTR_APP.state;
  const list = document.getElementById("activatedCodesList");
  if (!list) return;

  if (s.accessCodes.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 24px 10px; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: var(--radius-md);">
        <div style="font-size: 1.5rem; margin-bottom: 6px;">🔒</div>
        <strong>No codes activated yet</strong>
        <div style="font-size: 0.8rem; margin-top: 4px;">Enter your subscription access code to connect to the provider catalogue.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = s.accessCodes.map(c => `
    <div class="code-card">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="code-text">${c.code}</span>
          <span class="badge-active">${c.status}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
          ${c.name ? `User: <strong>${escapeHtml(c.name)}</strong> • ` : ""}${escapeHtml(c.provider || "Connected provider")} • <strong>${Number.isFinite(c.unlockedChannels) ? c.unlockedChannels.toLocaleString() + " Channels" : "Catalogue synced on connection"}</strong>
        </div>
      </div>
      <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.78rem; border-color: rgba(239, 68, 68, 0.4); color: #EF4444;" onclick="window.removeAccessCode('${c.code}')">
        Remove
      </button>
    </div>
  `).join("");
}

// Auto-activate saved valid code or session on startup
document.addEventListener("DOMContentLoaded", () => {
  const s = window.GPTR_APP.state;
  if (s.activeCode && s.session) {
    console.log(`[STARTUP] Auto-loading active session for code: ${s.activeCode}`);
    window.loadUnlockedCatalog(s.session, s.activeCode);
  } else {
    updateDOMBadges();
    renderLiveBanner();
  }
});
