// ==========================================================================
// GPTR TV - Comprehensive IPTV & Entertainment Catalogue
// Channels, Movies (VOD), TV Series, Live Sports, Bigg Boss & Music
// ==========================================================================

window.GPTR_DATA = {
  // Full Live TV Channels Catalogue (14,740+ Unlocked Channels)
  // Live channels are supplied only by the authenticated server catalogue.
  channels: (typeof window !== "undefined" && Array.isArray(window.GPTR_UNLOCKED_CHANNELS))
    ? window.GPTR_UNLOCKED_CHANNELS
    : [],

  featured: [
    {
      id: "feat-1",
      title: "Cyber Odyssey: Beyond the Horizon",
      type: "Movie",
      category: "Sci-Fi / Action",
      rating: "4.9",
      year: "2026",
      duration: "2h 35m",
      backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80",
      poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80",
      synopsis: "In a neon-drenched metropolis on the brink of an AI revolution, a rogue neural pilot uncovers a planetary conspiracy encoded within deep space quantum signals.",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
    },
    {
      id: "feat-2",
      title: "IND vs AUS: Border-Gavaskar Trophy Live",
      type: "Live Sports",
      category: "Cricket / Day 4",
      rating: "Live",
      year: "2026",
      duration: "LIVE",
      backdrop: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1600&auto=format&fit=crop&q=80",
      poster: "https://images.unsplash.com/photo-1531415074868-036b107e775a?w=500&auto=format&fit=crop&q=80",
      synopsis: "Witness explosive action in the 3rd Test as India battles Australia down to the final wire. Ball-by-ball commentary and multicam stream.",
      streamUrl: "https://test-streams.mux.dev/test_001/stream.m3u8"
    },
    {
      id: "feat-3",
      title: "Bigg Boss 24/7 Live House",
      type: "Reality TV",
      category: "Entertainment",
      rating: "9.5",
      year: "Season 19",
      duration: "24x7 Uncut",
      backdrop: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80",
      poster: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=80",
      synopsis: "Step inside the Bigg Boss house with uninterrupted 24-hour live camera access. No edits, no censorship, pure real-time drama.",
      streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
    }
  ],

  // Movies Catalogue (VOD - 12+ Titles)
  movies: [
    {
      id: "mov-1",
      title: "Tears of Steel",
      year: "2024",
      rating: "8.6",
      duration: "1h 45m",
      genre: "Sci-Fi",
      poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
      synopsis: "Set in a dystopian future where Amsterdam has been transformed into a robotics fortress, a team of scientists attempt to rewrite traumatic memories to save humanity.",
      director: "Ian Hubert",
      cast: "Derek de Lint, Sergio Hasselbaink, Rogier Schippers",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
    },
    {
      id: "mov-2",
      title: "Big Buck Bunny",
      year: "2023",
      rating: "8.2",
      duration: "1h 30m",
      genre: "Animation",
      poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80",
      synopsis: "A giant rabbit with a kind heart stands up to bullying forest rodents in this award-winning 4K masterpiece.",
      director: "Sacha Goedegebure",
      cast: "Animated Cast",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    },
    {
      id: "mov-3",
      title: "Elephants Dream",
      year: "2024",
      rating: "8.5",
      duration: "2h 10m",
      genre: "Action",
      poster: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&auto=format&fit=crop&q=80",
      synopsis: "Two explorers navigate a mind-bending labyrinth inside a colossal mechanical entity where reality bends at every turn.",
      director: "Bassam Kurdali",
      cast: "Tygo Gernandt, Cas Jansen",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    },
    {
      id: "mov-4",
      title: "Cosmic Odyssey 4K",
      year: "2025",
      rating: "9.1",
      duration: "2h 28m",
      genre: "Drama",
      poster: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
      synopsis: "An emotional odyssey across distant star systems exploring humanity's legacy, loneliness, and survival in the boundless cosmos.",
      director: "Alex Garland",
      cast: "Natalie Portman, Oscar Isaac, Benedict Wong",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    },
    {
      id: "mov-5",
      title: "Night of the Phantom",
      year: "2025",
      rating: "7.9",
      duration: "1h 52m",
      genre: "Thriller",
      poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80",
      synopsis: "A detective with memory lapses must solve a high-stakes crime syndicate infiltration before his past catches up with him.",
      director: "David Fincher",
      cast: "Jake Gyllenhaal, Rooney Mara",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    },
    {
      id: "mov-6",
      title: "Neon Velocity",
      year: "2026",
      rating: "8.8",
      duration: "2h 05m",
      genre: "Action",
      poster: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&auto=format&fit=crop&q=80",
      synopsis: "High-octane midnight street racers become the only line of defense against an international weapons syndicate.",
      director: "Justin Lin",
      cast: "Idris Elba, Michelle Rodriguez, Sung Kang",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
    },
    {
      id: "mov-7",
      title: "Sintel: Dragon's Legacy",
      year: "2024",
      rating: "8.7",
      duration: "1h 38m",
      genre: "Animation",
      poster: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&auto=format&fit=crop&q=80",
      synopsis: "A lonely young woman searches the lands for her kidnapped dragon friend, only to discover heartbreaking secrets of destiny.",
      director: "Colin Levy",
      cast: "Halina Reijn, Thom Hoffman",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
    },
    {
      id: "mov-8",
      title: "Solar Flare",
      year: "2025",
      rating: "8.3",
      duration: "2h 15m",
      genre: "Sci-Fi",
      poster: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80",
      synopsis: "When an apocalyptic solar anomaly cuts off satellite communications globally, space station crew members must make a perilous journey home.",
      director: "Denis Villeneuve",
      cast: "Ryan Gosling, Ana de Armas",
      streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4"
    }
  ],

  // TV Series Catalogue (Full Seasons & Episodes)
  series: [
    {
      id: "ser-1",
      title: "Shadow Protocol",
      seasonsCount: 3,
      rating: "9.2",
      genre: "Action / Espionage",
      poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
      synopsis: "A rogue intelligence operative operates off the grid to expose government corruption while being hunted by his former mentors.",
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { episodeNumber: 1, title: "Ghost in the Machine", duration: "52m", overview: "Agent Miller vanishes following a sabotaged extraction in Vienna.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4" },
            { episodeNumber: 2, title: "Cipher Zero", duration: "48m", overview: "Decrypting the black box reveals an impossible inside threat.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4" },
            { episodeNumber: 3, title: "The Blackout", duration: "55m", overview: "A power plant in Berlin is compromised during a city-wide manhunt.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" }
          ]
        },
        {
          seasonNumber: 2,
          episodes: [
            { episodeNumber: 1, title: "Resurgence", duration: "54m", overview: "New allies emerge in the underground tunnels of Bucharest.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" },
            { episodeNumber: 2, title: "Double Blind", duration: "50m", overview: "A covert exchange goes south when an assassin intervenes.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }
          ]
        }
      ]
    },
    {
      id: "ser-2",
      title: "Quantum Realm",
      seasonsCount: 2,
      rating: "8.9",
      genre: "Sci-Fi / Mystery",
      poster: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&auto=format&fit=crop&q=80",
      synopsis: "Physicists accidently crack parallel universe transmission and receive desperate warnings from alternative versions of themselves.",
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { episodeNumber: 1, title: "The Split", duration: "46m", overview: "The collider produces anomalies never before recorded in physics.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4" },
            { episodeNumber: 2, title: "Echo Chamber", duration: "51m", overview: "Auditory transmissions reveal a timeline that already collapsed.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4" }
          ]
        }
      ]
    },
    {
      id: "ser-3",
      title: "The Narco Empire",
      seasonsCount: 4,
      rating: "9.4",
      genre: "Crime / Drama",
      poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&auto=format&fit=crop&q=80",
      backdrop: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80",
      synopsis: "Chronicles the gripping rise and brutal clashes of rival cartels fighting for dominance along international supply corridors.",
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { episodeNumber: 1, title: "Borderline", duration: "58m", overview: "New shipment routes open up as federal agencies launch Operation Condor.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
            { episodeNumber: 2, title: "Kingmaker", duration: "55m", overview: "Secret alliances form inside the high-security prison.", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" }
          ]
        }
      ]
    }
  ],

  // Live Cricket Scores & Match Data
  cricket: {
    match: {
      title: "India vs Australia - 3rd Test, Day 4",
      series: "Border-Gavaskar Trophy 2026",
      venue: "Melbourne Cricket Ground (MCG)",
      status: "LIVE - Session 2",
      toss: "India won the toss and elected to bat",
      indiaScore: "348 & 216/3 (58.2 ov)",
      australiaScore: "284 (84.1 ov)",
      lead: "India lead by 280 runs",
      runRate: "3.70 CRR",
      requiredRate: "-",
      batsmen: [
        { name: "Virat Kohli", runs: 78, balls: 112, fours: 9, sixes: 1, sr: "69.64", onStrike: true },
        { name: "KL Rahul", runs: 54, balls: 88, fours: 6, sixes: 0, sr: "61.36", onStrike: false }
      ],
      bowler: {
        name: "Pat Cummins",
        overs: "14.2",
        maidens: 2,
        runs: 48,
        wickets: 1,
        economy: "3.35"
      },
      recentBalls: ["1", "4", "0", "2", "0", "1", "|", "0", "0", "4", "1", "0"],
      commentary: [
        { over: "58.2", text: "Cummins to Kohli, 1 run, pushed gently towards mid-on for a sharp single. Kohli raises his bat to the roaring crowd!" },
        { over: "58.1", text: "Cummins to Kohli, FOUR! Cracking cover drive! Right out of the middle of the blade, race through the covers!" },
        { over: "57.6", text: "Starc to Rahul, no run, defended solidly off the back foot towards silly mid-off." },
        { over: "57.5", text: "Starc to Rahul, 2 runs, clipped through square leg, easy couple." }
      ]
    },
    upcomingMatches: [
      { teams: "ENG vs SA - 2nd ODI", time: "Tomorrow, 14:30 GMT", venue: "Lord's, London" },
      { teams: "PAK vs NZ - 1st T20I", time: "Friday, 19:00 PKT", venue: "Gaddafi Stadium, Lahore" },
      { teams: "CSK vs MI - IPL Opener", time: "Sunday, 19:30 IST", venue: "Wankhede Stadium, Mumbai" }
    ]
  },

  // Bigg Boss 24/7 Multi-Cam Feeds
  bigboss: {
    title: "Bigg Boss Live 24/7 Multicam",
    season: "Season 19",
    activeViewers: "142,850",
    feeds: [
      { id: "bb-1", name: "Living Room & Kitchen (Main)", camera: "Cam 1 - Master", streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", active: true },
      { id: "bb-2", name: "Garden & Pool Area", camera: "Cam 2 - Wide", streamUrl: "https://test-streams.mux.dev/test_001/stream.m3u8", active: false },
      { id: "bb-3", name: "Confession Room", camera: "Cam 3 - Close Up", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", active: false },
      { id: "bb-4", name: "Bedroom & Discussion Lounge", camera: "Cam 4 - Ambient", streamUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", active: false }
    ],
    highlights: [
      { title: "Heated Captaincy Task Clash", time: "18m ago", views: "450K", thumb: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60" },
      { title: "Emotional Letter from Family", time: "2h ago", views: "820K", thumb: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=300&auto=format&fit=crop&q=60" },
      { title: "Midnight Secret Conversation", time: "5h ago", views: "1.2M", thumb: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60" }
    ]
  },

  // Music Streaming & Synced Lyrics
  music: {
    trending: [
      {
        id: "mus-1",
        title: "Arabic Kuthu - Halamithi Habibo",
        artist: "Anirudh Ravichander, Jonita Gandhi",
        album: "Beast",
        duration: "4:39",
        cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60",
        audioUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
        lyrics: [
          { time: 0, text: "[Music Intro]" },
          { time: 12, text: "Halamithi habibo... Halamithi habibo" },
          { time: 24, text: "Malama pitha pithadhe... Malama pitha pithadhe" },
          { time: 36, text: "Holama pitha pithadhe... Halamithi habibo" },
          { time: 48, text: "Kannaana kanne unthan ninaivaale" },
          { time: 60, text: "Kaalam poora naan unnodae vaazhavenum" }
        ]
      },
      {
        id: "mus-2",
        title: "Kesariya",
        artist: "Arijit Singh, Pritam",
        album: "Brahmāstra",
        duration: "4:28",
        cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60",
        audioUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4",
        lyrics: [
          { time: 0, text: "[Acoustic Guitar Melodic Strumming]" },
          { time: 10, text: "Mujhko itna bataaye koyi" },
          { time: 18, text: "Kaise tujhpe fida na ho koyi" },
          { time: 26, text: "Kesarriya tera ishq hai piya" },
          { time: 38, text: "Rang jaaun jo main haath lagaaun" },
          { time: 50, text: "Din beete saara teri fikr mein" },
          { time: 62, text: "Rain saari teri khair manaun" }
        ]
      },
      {
        id: "mus-3",
        title: "Kadhaippoma",
        artist: "Sid Sriram",
        album: "Oh My Kadavule",
        duration: "4:15",
        cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&auto=format&fit=crop&q=60",
        audioUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4",
        lyrics: [
          { time: 0, text: "[Piano & Flute Intro]" },
          { time: 12, text: "Kadhaippoma... kadhaippoma..." },
          { time: 22, text: "Manam vittu unnodae kadhaippoma" },
          { time: 34, text: "Kaatrodu kaatraaga karaindhu povaen" },
          { time: 46, text: "Un kural ketka naan thavithu nirpaen" }
        ]
      },
      {
        id: "mus-4",
        title: "Faded",
        artist: "Alan Walker",
        album: "Different World",
        duration: "3:32",
        cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60",
        audioUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
        lyrics: [
          { time: 0, text: "[Piano Intro]" },
          { time: 14, text: "You were the shadow to my light" },
          { time: 22, text: "Did you feel us? Another start" },
          { time: 30, text: "You fade away, afraid our aim is out of sight" },
          { time: 42, text: "Wanna see us alive" },
          { time: 50, text: "Where are you now? Where are you now?" }
        ]
      }
    ]
  }
};
