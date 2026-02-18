const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");

const app = express();
const PORT = 5000;

const parser = new Parser();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Pathagar Lens Backend (RSS Mode) Running 🚀");
});

app.post("/api/fact/check", async (req, res) => {

  const { claim, page = 1 } = req.body;

  try {

    const start = (page - 1) * 20;

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(claim)}&hl=en-IN&gl=IN&ceid=IN:en&start=${start}`;

    const feed = await parser.parseURL(url);

    if (!feed.items || feed.items.length === 0) {
      return res.json({ results: [] });
    }

    const TRUSTED = [
      "BBC",
      "Reuters",
      "The Hindu",
      "NDTV",
      "Times of India",
      "Indian Express"
    ];

    const results = feed.items.map(item => {

      let credibility = "Low";

      if (TRUSTED.some(source =>
        item.title.toLowerCase().includes(source.toLowerCase())
      )) {
        credibility = "High";
      }

      return {
        title: item.title,
        link: item.link,
        credibility
      };
    });

    res.json({ results });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch RSS news" });
  }

});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
