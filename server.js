const express = require("express");
const cache = {};
const axios = require("axios");

const app = express();

app.get("/", (req, res) => {
  res.send("ResearchSphere Backend Running...");
});

/* 🔹 Crossref Search Route */
app.get("/search", async (req, res) => {
  const query = req.query.q;
const page = parseInt(req.query.page) || 1;
const limit = parseInt(req.query.limit) || 5;

const cacheKey = `${query}_${page}_${limit}`;

if (cache[cacheKey]) {
  console.log("Serving from cache");
  return res.json(cache[cacheKey]);
}

  try {

    // Crossref
    const crossrefRes = await axios.get(
      `https://api.crossref.org/works?query=${query}&rows=5`
    );

    const crossrefData = crossrefRes.data.message.items.map(item => ({
      title: item.title ? item.title[0] : "No title",
      authors: item.author
        ? item.author.map(a => `${a.given || ""} ${a.family || ""}`)
        : [],
      journal: item["container-title"]
        ? item["container-title"][0]
        : "Unknown",
      year: item.issued?.["date-parts"]?.[0]?.[0] || "N/A",
      doi: item.DOI,
      citation_count: null,
      source: "Crossref"
    }));


    // OpenAlex
    const openalexRes = await axios.get(
      `https://api.openalex.org/works?search=${query}&per-page=5`
    );

    const openalexData = openalexRes.data.results.map(item => ({
      title: item.title || "No title",
      authors: item.authorships
        ? item.authorships.map(a => a.author.display_name)
        : [],
      journal: item.host_venue?.display_name || "Unknown",
      year: item.publication_year || "N/A",
      doi: item.doi ? item.doi.replace("https://doi.org/", "") : null,
      citation_count: item.cited_by_count,
      source: "OpenAlex"
    }));


    // 🔹 Merge দুইটা array
    const combined = [...crossrefData, ...openalexData];

    // 🔹 Duplicate Remove by DOI
    const unique = [];
    const seen = new Set();

    for (let item of combined) {
      if (item.doi) {
        if (!seen.has(item.doi)) {
          seen.add(item.doi);
          unique.push(item);
        }
      } else {
        unique.push(item);
      }
    }

// 🔹 Open Access Enrichment
await Promise.all(
  unique.map(async (item) => {
    if (item.doi) {
      try {
        const oaRes = await axios.get(
          `https://api.unpaywall.org/v2/${item.doi}?email=test@example.com`
        );

        item.open_access = oaRes.data.is_oa;
        item.pdf_url = oaRes.data.best_oa_location
          ? oaRes.data.best_oa_location.url
          : null;

      } catch (err) {
        item.open_access = false;
        item.pdf_url = null;
      }
    }
  })
);

unique.sort((a, b) => {
  return (b.citation_count || 0) - (a.citation_count || 0);
});

// 🔹 Pagination
const startIndex = (page - 1) * limit;
const endIndex = page * limit;

const paginatedResults = unique.slice(startIndex, endIndex);

cache[cacheKey] = {
  total_results: unique.length,
  current_page: page,
  total_pages: Math.ceil(unique.length / limit),
  results: paginatedResults
};
res.json(cache[cacheKey]);

    res.json({
  total_results: unique.length,
  current_page: page,
  total_pages: Math.ceil(unique.length / limit),
  results: paginatedResults
});

  } catch (error) {
    res.status(500).send("Error fetching data");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});