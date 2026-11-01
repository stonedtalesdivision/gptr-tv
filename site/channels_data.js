// GPTR TV catalogue data.
// Real catalogue entries are loaded from the authenticated server API.
window.GPTR_DATA = {
  channels: (typeof window !== "undefined" && Array.isArray(window.GPTR_UNLOCKED_CHANNELS))
    ? window.GPTR_UNLOCKED_CHANNELS
    : [],
  featured: [],
  movies: [],
  series: [],
  cricket: null,
  bigboss: null,
  music: { trending: [] }
};
