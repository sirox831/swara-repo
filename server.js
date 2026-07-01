const express = require("express");
const cors    = require("cors");
const ytdl    = require("@distube/ytdl-core");
const NodeCache = require("node-cache");

const app   = express();
const cache = new NodeCache({ stdTTL: 1800 }); // cache 30 menit

app.use(cors());
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";

// ===== GET AUDIO URL =====
app.get("/api/get-audio", async (req, res) => {
  const { videoId } = req.query;
  if(!videoId) return res.status(400).json({ error: "videoId diperlukan" });

  const cached = cache.get("audio_" + videoId);
  if(cached) return res.json(cached);

  try{
    const info = await ytdl.getInfo(videoId);
    const formats = ytdl.filterFormats(info.formats, "audioonly");

    // Prioritaskan m4a itag 140
    const best = formats.find(f => f.itag === 140)
      || formats.find(f => f.audioQuality === "AUDIO_QUALITY_MEDIUM")
      || formats[0];

    if(!best) return res.status(404).json({ error: "Format audio tidak tersedia" });

    const result = {
      audioUrl: best.url,
      title:    info.videoDetails.title,
      duration: parseInt(info.videoDetails.lengthSeconds),
    };

    cache.set("audio_" + videoId, result);
    res.json(result);
  } catch(err){
    console.error("get-audio error:", err.message);
    res.status(404).json({ error: "Gagal mengambil audio" });
  }
});

// ===== SEARCH MUSIK =====
app.get("/api/search", async (req, res) => {
  const { q } = req.query;
  if(!q) return res.status(400).json({ error: "query diperlukan" });
  if(!YOUTUBE_API_KEY) return res.status(500).json({ error: "API key belum diset" });

  const cached = cache.get("search_" + q);
  if(cached) return res.json(cached);

  try{
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=24&regionCode=ID&relevanceLanguage=id&q=${encodeURIComponent(q)}&key=${YOUTUBE_API_KEY}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if(data.error) return res.status(400).json({ error: data.error.message });

    const tracks = (data.items || [])
      .filter(i => i.id && i.id.videoId)
      .map(i => ({
        videoId:      i.id.videoId,
        trackName:    i.snippet.title,
        artistName:   i.snippet.channelTitle,
        artworkUrl:   i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || "",
      }));

    cache.set("search_" + q, tracks);
    res.json(tracks);
  } catch(err){
    console.error("search error:", err.message);
    res.status(500).json({ error: "Gagal mencari lagu" });
  }
});

// ===== HEALTH CHECK =====
app.get("/", (req, res) => res.json({ status: "Swara Backend aktif ✓" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Swara Backend jalan di port ${PORT}`));
