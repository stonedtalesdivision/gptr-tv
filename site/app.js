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
    accessCodes: JSON.parse(localStorage.getItem("gptrtv_access_codes") || JSON.stringify([{code:"RAGHU4571",name:"Gandreti Raghu",provider:"STAR-NETWORK (livebox.pro)",activatedAt:new Date().toLocaleDateString(),expiresAt:"Active VIP Subscription",status:"ACTIVE",unlockedChannels:14740,server:"http://livebox.pro"}])),
    activeCode: localStorage.getItem("gptrtv_active_code") || "RAGHU4571",
    session: JSON.parse(localStorage.getItem("gptrtv_session") || JSON.stringify({success:true,name:"Gandreti Raghu",playlistType:"xtream",xtreamServer:"http://livebox.pro",xtreamUsername:"5403259",xtreamPassword:"precious6mark"})),
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
            <h4 style="margin-bottom: 12px; font-weight: 700;">Season ${s1.seasonNumber || 1} Episodes (${s1.episodes.length})</h4>
            <div class="episodes-list">
              ${s1.episodes.map(ep => `
                <div class="episode-item" onclick="closeDetailModal(); window.openVideoPlayer({title:'${escapeQuotes(item.title)} E${ep.episodeNumber}: ${escapeQuotes(ep.title)}', epg:'TV Episode', logo:'${item.poster || ''}', streamUrl:'${ep.streamUrl}'})">
                  <div>
                    <strong>E${ep.episodeNumber}. ${ep.title}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${ep.duration || '45m'} ${ep.overview ? '• ' + ep.overview : ''}</div>
                  </div>
                  <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">▶ Play</button>
                </div>
              `).join("")}
            </div>
          `;
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
    homeCh.innerHTML = s.channels.slice(0, 8).map(ch => {
      const isFav = s.favorites.includes(ch.id);
      const nowTitle = ch.epg?.now?.title || "Live Stream";
      const progress = ch.epg?.now?.progress || 50;

      return `
        <div class="channel-card" onclick="window.openVideoPlayer({title:'${ch.name}', epg:'${nowTitle}', logo:'${ch.logo}', streamUrl:'${ch.streamUrl}', channelId:'${ch.id}'})" tabindex="0">
          <div class="channel-card-top">
            <div class="channel-logo-wrap">
              <img class="channel-logo" src="${ch.logo}" alt="${ch.name}" onerror="this.src='img/logo.png'">
            </div>
            <div class="channel-badges">
              <span class="badge badge-red">LIVE</span>
              <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); window.toggleFavorite('${ch.id}')">★</button>
            </div>
          </div>
          <div class="channel-info">
            <h3 class="channel-name">${ch.name}</h3>
            <span class="channel-category">${ch.category} • ${ch.quality || 'HD'}</span>
          </div>
          <div class="epg-info">
            <div class="epg-now">▶ ${nowTitle}</div>
            <div class="epg-progress-bar"><div class="epg-progress-fill" style="width: ${progress}%;"></div></div>
          </div>
        </div>
      `;
    }).join("");
  }

  // 2. Home Movies Row (First 6 movies)
  const homeMov = document.getElementById("homeMoviePreview");
  if (homeMov && s.movies.length > 0) {
    homeMov.innerHTML = s.movies.slice(0, 6).map(m => `
      <div class="media-card" onclick="window.openDetailModal(window.GPTR_APP.state.movies.find(x => x.id === '${m.id}'), 'movie')" tabindex="0">
        <div class="media-poster-wrap">
          <img class="media-poster" src="${m.poster}" alt="${m.title}" loading="lazy">
          <div class="media-rating">★ ${m.rating}</div>
          <div class="media-overlay">
            <div class="play-circle"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          </div>
        </div>
        <div class="media-info">
          <h4 class="media-title">${m.title}</h4>
          <div class="media-sub"><span>${m.year}</span><span>${m.genre}</span></div>
        </div>
      </div>
    `).join("");
  }

  // 3. Home Series Row (All series)
  const homeSer = document.getElementById("homeSeriesPreview");
  if (homeSer && s.series.length > 0) {
    homeSer.innerHTML = s.series.map(ser => `
      <div class="media-card" onclick="window.openDetailModal(window.GPTR_APP.state.series.find(x => x.id === '${ser.id}'), 'series')" tabindex="0">
        <div class="media-poster-wrap">
          <img class="media-poster" src="${ser.poster}" alt="${ser.title}" loading="lazy">
          <div class="media-rating">★ ${ser.rating}</div>
          <div class="media-overlay">
            <div class="play-circle"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
          </div>
        </div>
        <div class="media-info">
          <h4 class="media-title">${ser.title}</h4>
          <div class="media-sub"><span>${ser.seasonsCount} Seasons</span><span>${ser.genre}</span></div>
        </div>
      </div>
    `).join("");
  }
}

function updateDOMBadges() {
  const s = window.GPTR_APP.state;
  const countStr = s.channels.length > 1000 ? s.channels.length.toLocaleString() : `${s.channels.length}+`;
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
      btn.innerHTML = `✓ ${s.activeCode} (VIP)`;
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
          ✓ <strong>VIP Access Active (${s.activeCode}):</strong> ${s.channels.length.toLocaleString()} Live Channels & Full VOD Unlocked for ${s.session?.name || "Gandreti Raghu"}
        </div>
        <button class="btn-secondary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="window.switchTab('codes')">Manage Code</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="unlock-prompt-banner">
        <div class="unlock-prompt-text">
          🔑 <strong>Access Code Required:</strong> Enter <code>RAGHU4571</code> to unlock 10,000+ live TV channels, movies & series catalogues from server.
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
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; color: var(--text-muted);"><h3>No Channels found in this category</h3><p>Try selecting another category or searching for a specific channel name.</p></div>`;
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
  renderLiveChannels(cat, document.getElementById("globalSearch")?.value || "");
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
    const totalCount = s.vodCategories ? s.vodCategories.length : 172;
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
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <h3>No movies loaded yet for "${filterGenre}"</h3>
        <p style="margin-top: 8px;">Click "Fetch Movies" or select another category from the 172 available genres above.</p>
        <button class="btn-primary" style="margin-top: 16px; padding: 8px 20px; border-radius: var(--radius-full);" onclick="window.selectMovieCategory('${escapeQuotes(filterGenre)}')">
          🔄 Fetch ${filterGenre} Movies
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="media-card" onclick="window.openDetailModal(window.GPTR_APP.state.movies.find(x => x.id === '${m.id}'), 'movie')" tabindex="0">
      <div class="media-poster-wrap">
        <img class="media-poster" src="${m.poster}" alt="${escapeQuotes(m.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500'">
        <div class="media-rating">★ ${m.rating}</div>
        <div class="media-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
      </div>
      <div class="media-info">
        <h4 class="media-title">${m.title}</h4>
        <div class="media-sub"><span>${m.year}</span><span>${m.genre}</span></div>
      </div>
    </div>
  `).join("");
}

window.selectMovieCategory = async function(cat) {
  const s = window.GPTR_APP.state;
  s.activeMovieGenre = cat;

  if (cat === "All") {
    renderMovies("All");
    return;
  }

  const catObj = (s.vodCategories || []).find(c => c.category_name === cat);
  if (catObj && catObj.category_id) {
    const catId = catObj.category_id;
    const existing = s.movies.filter(m => String(m.categoryId) === String(catId) || m.genre === cat);
    if (existing.length === 0) {
      const grid = document.getElementById("movieGrid");
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
            <div class="player-spinner" style="margin: 0 auto 16px auto;"></div>
            <p style="color: var(--text-primary); font-weight: 600;">Loading movies for ${cat}...</p>
          </div>
        `;
      }
      try {
        const res = await fetch(`/api/catalog/vod-streams?category_id=${catId}`);
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            const formatted = items.map(m => ({
              id: "vod_" + m.stream_id,
              stream_id: m.stream_id,
              title: m.name,
              genre: cat,
              categoryId: String(catId),
              year: (m.name.match(/\((\d{4})\)/) || [])[1] || "2024",
              rating: m.rating || "8.5",
              poster: (m.stream_icon && m.stream_icon.startsWith("http")) ? m.stream_icon : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500",
              backdrop: (m.stream_icon && m.stream_icon.startsWith("http")) ? m.stream_icon : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200",
              streamUrl: `/stream/movie/${m.stream_id}.${m.container_extension || "mp4"}`,
              description: `${m.name} - Ultra High Definition streaming.`,
              quality: m.name.includes("4K") ? "4K" : "1080p",
              duration: "135m"
            }));
            const existingIds = new Set(s.movies.map(m => m.id));
            formatted.forEach(item => {
              if (!existingIds.has(item.id)) {
                s.movies.push(item);
                existingIds.add(item.id);
              }
            });
          }
        }
      } catch (e) {
        console.warn("Error fetching movies for category", catId, e);
      }
    }
  }

  renderMovies(cat);
};

window.renderSeriesCategoryChipsList = function(categories, activeCat, queryFilter = "") {
  const chips = document.getElementById("seriesCategoryChips");
  if (!chips) return;
  const s = window.GPTR_APP.state;

  let displayCats = categories;
  if (queryFilter && queryFilter.trim()) {
    const q = queryFilter.toLowerCase().trim();
    displayCats = categories.filter(c => c === "All" || c === activeCat || c.toLowerCase().includes(q));
  }

  chips.innerHTML = displayCats.map(cat => {
    const count = cat === "All" ? s.series.length : s.series.filter(ser => ser.genre === cat).length;
    return `
      <button class="chip ${cat === activeCat ? 'active' : ''}" onclick="window.selectSeriesCategory('${escapeQuotes(cat)}')">
        ${cat} <span class="chip-count">${count > 0 ? count : ''}</span>
      </button>
    `;
  }).join("");
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
    const totalCount = s.seriesCategories ? s.seriesCategories.length : 301;
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
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px; color: var(--text-muted);">
        <h3>No TV series loaded yet for "${filterGenre}"</h3>
        <p style="margin-top: 8px;">Click "Fetch Series" or select another category from the 301 available categories above.</p>
        <button class="btn-primary" style="margin-top: 16px; padding: 8px 20px; border-radius: var(--radius-full);" onclick="window.selectSeriesCategory('${escapeQuotes(filterGenre)}')">
          🔄 Fetch ${filterGenre} Series
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(ser => `
    <div class="media-card" onclick="window.openDetailModal(window.GPTR_APP.state.series.find(x => x.id === '${ser.id}'), 'series')" tabindex="0">
      <div class="media-poster-wrap">
        <img class="media-poster" src="${ser.poster}" alt="${escapeQuotes(ser.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=500'">
        <div class="media-rating">★ ${ser.rating}</div>
        <div class="media-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        </div>
      </div>
      <div class="media-info">
        <h4 class="media-title">${ser.title}</h4>
        <div class="media-sub"><span>${ser.seasonsCount || 1} Seasons</span><span>${ser.genre}</span></div>
      </div>
    </div>
  `).join("");
}

window.selectSeriesCategory = async function(cat) {
  const s = window.GPTR_APP.state;
  s.activeSeriesGenre = cat;

  if (cat === "All") {
    renderSeries("All");
    return;
  }

  const catObj = (s.seriesCategories || []).find(c => c.category_name === cat);
  if (catObj && catObj.category_id) {
    const catId = catObj.category_id;
    const existing = s.series.filter(ser => String(ser.categoryId) === String(catId) || ser.genre === cat);
    if (existing.length === 0) {
      const grid = document.getElementById("seriesGrid");
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
            <div class="player-spinner" style="margin: 0 auto 16px auto;"></div>
            <p style="color: var(--text-primary); font-weight: 600;">Loading TV series for ${cat}...</p>
          </div>
        `;
      }
      try {
        const res = await fetch(`/api/catalog/series?category_id=${catId}`);
        if (res.ok) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            const formatted = items.map(ser => ({
              id: "ser_" + ser.series_id,
              series_id: ser.series_id,
              title: ser.name,
              genre: cat,
              categoryId: String(catId),
              seasonsCount: 1,
              rating: ser.rating || "8.0",
              poster: (ser.cover && ser.cover.startsWith("http")) ? ser.cover : "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=500",
              backdrop: (ser.cover && ser.cover.startsWith("http")) ? ser.cover : "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200",
              description: `${ser.name} - Complete Series & Episodes.`,
              quality: "HD"
            }));
            const existingIds = new Set(s.series.map(ser => ser.id));
            formatted.forEach(item => {
              if (!existingIds.has(item.id)) {
                s.series.push(item);
                existingIds.add(item.id);
              }
            });
          }
        }
      } catch (e) {
        console.warn("Error fetching series for category", catId, e);
      }
    }
  }

  renderSeries(cat);
};

function renderCricketSection() {
  const data = window.GPTR_DATA.cricket;
  const container = document.getElementById("cricketCardContainer");
  if (!container || !data) return;

  container.innerHTML = `
    <div class="cricket-card-wrap">
      <div class="cricket-header">
        <div>
          <span class="badge badge-red" style="margin-right: 8px;">LIVE CRICKET</span>
          <strong>${data.match.title}</strong>
        </div>
        <span class="cricket-series">${data.match.venue}</span>
      </div>

      <div class="cricket-teams-row">
        <div class="team-box">
          <div class="team-name">India (Batting)</div>
          <div class="team-score">${data.match.indiaScore}</div>
          <div style="font-size: 0.85rem; color: #10B981; margin-top: 4px;">${data.match.lead} (${data.match.runRate})</div>
        </div>
        <div class="team-box">
          <div class="team-name">Australia</div>
          <div class="team-score">${data.match.australiaScore}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">1st Innings: Trail by 64 runs</div>
        </div>
      </div>

      <div class="cricket-stats-grid">
        <div class="batsmen-table">
          <div style="font-weight: 700; margin-bottom: 8px; font-size: 0.9rem;">Current Batsmen</div>
          ${data.match.batsmen.map(b => `
            <div class="table-row">
              <span><strong>${b.name}</strong> ${b.onStrike ? '*' : ''}</span>
              <span><strong>${b.runs}</strong> (${b.balls}) • ${b.fours}x4 ${b.sixes}x6 • SR: ${b.sr}</span>
            </div>
          `).join("")}
          <div class="balls-ticker">
            <span style="font-size: 0.8rem; color: var(--text-muted);">This Over:</span>
            ${data.match.recentBalls.map(ball => {
              let cls = "";
              if (ball === "4") cls = "ball-four";
              if (ball === "6") cls = "ball-six";
              if (ball === "W") cls = "ball-wicket";
              return `<div class="ball-circle ${cls}">${ball}</div>`;
            }).join("")}
          </div>
        </div>

        <div class="bowler-box">
          <div style="font-weight: 700; margin-bottom: 8px; font-size: 0.9rem;">Current Bowler</div>
          <div style="font-size: 1.05rem; font-weight: 800;">${data.match.bowler.name}</div>
          <div style="margin-top: 6px; font-size: 0.88rem; color: var(--text-secondary);">
            ${data.match.bowler.overs} ov • ${data.match.bowler.maidens} M • ${data.match.bowler.runs} R • ${data.match.bowler.wickets} W
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Econ: ${data.match.bowler.economy}</div>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 10px;">Live Ball-by-Ball Commentary</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${data.match.commentary.map(comm => `
            <div style="background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.88rem;">
              <strong style="color: var(--brand-red); margin-right: 8px;">${comm.over}</strong>
              <span>${comm.text}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderBiggBoss() {
  const bb = window.GPTR_DATA.bigboss;
  const grid = document.getElementById("multicamGrid");
  if (!grid || !bb) return;

  grid.innerHTML = bb.feeds.map(feed => `
    <div class="multicam-feed" onclick="window.openVideoPlayer({title:'Bigg Boss 24/7 - ${feed.name}', epg:'${bb.season} Live Feed', logo:'img/logo.png', streamUrl:'${feed.streamUrl}'})">
      <div class="multicam-thumb-wrap">
        <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=70" alt="${feed.name}">
        <div class="cam-badge">🔴 ${feed.camera}</div>
        <div class="play-circle" style="position: absolute;">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="multicam-feed-info">
        <div>
          <strong>${feed.name}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${bb.season} • 24x7 Live Feed</div>
        </div>
        <span class="badge badge-red">LIVE</span>
      </div>
    </div>
  `).join("");
}

function renderMusicSection() {
  const songs = window.GPTR_DATA.music.trending;
  const list = document.getElementById("songList");
  if (!list) return;

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
  if (!scroll || !s.currentTrack?.lyrics) return;

  scroll.innerHTML = s.currentTrack.lyrics.map((l, i) => `
    <div class="lyrics-line ${i === s.currentLyricIndex ? 'active' : ''}" onclick="window.GPTR_APP.state.audioElement.currentTime=${l.time}">
      ${l.text}
    </div>
  `).join("");
}

function renderChannelDrawer() {
  const s = window.GPTR_APP.state;
  const drawer = document.getElementById("drawerList");
  if (!drawer) return;

  drawer.innerHTML = s.channels.map((ch, idx) => `
    <div class="drawer-item ${idx === s.currentChannelIndex ? 'active' : ''}" onclick="window.GPTR_APP.state.currentChannelIndex=${idx}; window.openVideoPlayer({title:'${ch.name}', epg:'${ch.category}', logo:'${ch.logo}', streamUrl:'${ch.streamUrl}', channelId:'${ch.id}'})">
      <img class="drawer-thumb" src="${ch.logo}" alt="${ch.name}" onerror="this.src='img/logo.png'">
      <div>
        <div style="font-weight: 700; font-size: 0.9rem;">${ch.name}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${ch.category}</div>
      </div>
    </div>
  `).join("");
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
      let filtered = s.movies.filter(m => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
      const grid = document.getElementById("movieGrid");
      if (grid) {
        grid.innerHTML = filtered.map(m => `
          <div class="media-card" onclick="window.openDetailModal(window.GPTR_APP.state.movies.find(x => x.id === '${m.id}'), 'movie')">
            <div class="media-poster-wrap"><img class="media-poster" src="${m.poster}" alt="${m.title}"><div class="media-rating">★ ${m.rating}</div></div>
            <div class="media-info"><h4 class="media-title">${m.title}</h4><div class="media-sub"><span>${m.year}</span><span>${m.genre}</span></div></div>
          </div>
        `).join("");
      }
    }
  });

  // Initial Renders
  // Immediately load all 172 VOD categories and 301 Series categories from static JSON
  try {
    fetch('/unlocked_vod_categories.json')
      .then(r => r.json())
      .then(cats => {
        if (Array.isArray(cats)) {
          window.GPTR_APP.state.vodCategories = cats;
          if (window.GPTR_APP.state.currentTab === "movies") renderMovies();
        }
      }).catch(e => console.warn("Failed loading vod_categories.json", e));

    fetch('/unlocked_series_categories.json')
      .then(r => r.json())
      .then(cats => {
        if (Array.isArray(cats)) {
          window.GPTR_APP.state.seriesCategories = cats;
          if (window.GPTR_APP.state.currentTab === "series") renderSeries();
        }
      }).catch(e => console.warn("Failed loading series_categories.json", e));
  } catch (e) {}

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

window.loadUnlockedCatalog = async function(session, code) {
  const s = window.GPTR_APP.state;
  s.isLoadingCatalog = true;

  console.log("[CATALOG] Fetching 14,740+ channels and VOD from server...");
  renderLiveBanner();

  try {
    // 1. Fetch categories
    const catMap = {};
    try {
      const catRes = await fetch("/api/catalog/live-categories");
      if (catRes.ok) {
        const cats = await catRes.json();
        s.liveCategories = cats;
        cats.forEach(c => { catMap[c.category_id] = c.category_name; });
      }
    } catch (e) {
      console.warn("Failed to fetch live categories:", e);
    }

    // 2. Fetch live streams (14,740 channels!)
    try {
      const streamRes = await fetch("/api/catalog/live-streams");
      if (streamRes.ok) {
        const streams = await streamRes.json();
        console.log(`[CATALOG] Successfully received ${streams.length} channels from server!`);

        s.channels = streams.map(item => ({
          id: "xtream_" + item.stream_id,
          stream_id: item.stream_id,
          num: item.num,
          name: item.name,
          category: catMap[item.category_id] || "General Live",
          categoryId: item.category_id,
          logo: (item.stream_icon && item.stream_icon.startsWith("http")) ? item.stream_icon : "img/logo.png",
          streamUrl: `/stream/live/${item.stream_id}.m3u8`,
          directUrl: `http://livebox.pro/live/5403259/precious6mark/${item.stream_id}.ts`,
          quality: item.name.includes("4K") ? "4K" : (item.name.includes("FHD") ? "FHD" : "HD"),
          epg: {
            now: { title: item.name + " Live Broadcast", progress: 50 }
          }
        }));
        s.unlockedChannelsCount = s.channels.length;
      }
    } catch (e) {
      console.warn("Failed to fetch live streams:", e);
    }

    // 3. Fetch VOD categories and top movies
    try {
      const vodCatRes = await fetch("/api/catalog/vod-categories");
      if (vodCatRes.ok) {
        const vodCats = await vodCatRes.json();
        const vodMap = {};
        vodCats.forEach(c => { vodMap[c.category_id] = c.category_name; });

        const vodRes = await fetch("/api/catalog/vod-streams?category_id=122");
        if (vodRes.ok) {
          const vodStreams = await vodRes.json();
          s.movies = vodStreams.slice(0, 100).map(m => ({
            id: "vod_" + m.stream_id,
            stream_id: m.stream_id,
            title: m.name,
            genre: vodMap[m.category_id] || "Action",
            categoryId: m.category_id,
            year: (m.name.match(/\((\d{4})\)/) || [])[1] || "2024",
            rating: m.rating || "8.5",
            poster: (m.stream_icon && m.stream_icon.startsWith("http")) ? m.stream_icon : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500",
            backdrop: (m.stream_icon && m.stream_icon.startsWith("http")) ? m.stream_icon : "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200",
            streamUrl: `/stream/movie/${m.stream_id}.${m.container_extension || "mp4"}`,
            description: `${m.name} - Ultra High Definition streaming.`,
            quality: m.name.includes("4K") ? "4K" : "1080p",
            duration: "135m"
          }));
        }
      }
    } catch (e) {
      console.warn("VOD load error:", e);
    }

    // 4. Fetch Series
    try {
      const serRes = await fetch("/api/catalog/series?category_id=518");
      if (serRes.ok) {
        const serStreams = await serRes.json();
        s.series = serStreams.map(ser => ({
          id: "ser_" + ser.series_id,
          series_id: ser.series_id,
          title: ser.name,
          genre: "Highlights & Sports",
          rating: ser.rating || "8.0",
          poster: (ser.cover && ser.cover.startsWith("http")) ? ser.cover : "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=500",
          backdrop: (ser.cover && ser.cover.startsWith("http")) ? ser.cover : "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1200",
          seasonsCount: 1,
          description: ser.plot || `${ser.name} - Complete highlights series.`,
          episodes: []
        }));
      }
    } catch (e) {
      console.warn("Series load error:", e);
    }

  } catch (err) {
    console.error("Catalog load error:", err);
  } finally {
    s.isLoadingCatalog = false;
    updateDOMBadges();
    renderLiveBanner();
    renderLiveChannels(s.activeCategory || "All");
    renderHomeView();
    renderMovies();
    renderSeries();
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
    console.log("Validation success:", data);

    if (!data.success) {
      if (statusEl) {
        statusEl.style.color = "#EF4444";
        statusEl.textContent = "✗ Invalid code response from server.";
      }
      return;
    }

    const s = window.GPTR_APP.state;
    s.activeCode = code;
    s.session = data;
    localStorage.setItem("gptrtv_active_code", code);
    localStorage.setItem("gptrtv_session", JSON.stringify(data));

    const newCodeEntry = {
      code: code,
      name: data.name || "Gandreti Raghu",
      provider: "STAR-NETWORK (livebox.pro)",
      activatedAt: new Date().toLocaleDateString(),
      expiresAt: "Active VIP Subscription",
      status: "ACTIVE",
      unlockedChannels: 14740,
      server: data.xtreamServer || "http://livebox.pro"
    };

    s.accessCodes = [newCodeEntry, ...s.accessCodes.filter(c => c.code !== code)];
    localStorage.setItem("gptrtv_access_codes", JSON.stringify(s.accessCodes));

    if (statusEl) {
      statusEl.style.color = "#10B981";
      statusEl.textContent = `✓ Code verified! Welcome, ${data.name || code}. Unlocking 14,740+ channels...`;
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
        <div style="font-size: 0.8rem; margin-top: 4px;">Enter a legitimate code like <strong>RAGHU4571</strong> to unlock server content.</div>
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
          ${c.name ? `User: <strong>${c.name}</strong> • ` : ""}${c.provider} • <strong>${(c.unlockedChannels || 14740).toLocaleString()} Channels</strong>
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
