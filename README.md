# 🐼🌙🐥 Fan Club Hashtag Tracker v3
### GitHub Pages + Actions — no extra accounts needed

---

## What changed in v3
- **tweet_volume** from Twitter trends API (real numbers, not sample counts)
- **Best rank ever** tracked and displayed per country
- **Pages auto-redeploys** after every fetch and trend scan
- All paths corrected — config and data live inside `docs/`
- Separate `deploy.yml` workflow for clean Pages deployment

---

## Setup (one time)

### 1. Upload to GitHub
Create a new **public** repo and upload all files keeping folder structure.

### 2. Enable GitHub Pages
Settings → Pages → Source: **GitHub Actions**

### 3. Add API key secret
Settings → Secrets → Actions → New secret:
- Name: `RAPIDAPI_KEY`
- Value: your RapidAPI key

### 4. Edit docs/config.json
Click the file in GitHub → pencil icon → edit your hashtags → commit.

### 5. First run
Actions → **Fetch counts** → Run workflow

---

## How it works

```
Every 30 min (auto):
  fetch.js → calls trends API for each tag
           → gets tweet_volume (real Twitter number)
           → saves to docs/data/snapshots.json
           → commits back + triggers Pages redeploy

Manual only:
  trends.js → scans all countries for event tags
            → records current rank + best rank ever
            → saves to docs/data/trends.json
            → commits back + triggers Pages redeploy
```

---

## config.json reference

```json
{
  "title": "My Fan Club ✦",
  "rapidApiKey": "",

  "permSlots": [
    {
      "id": "perm-0",
      "hashtag": "#ArtistName",
      "keyword": "ArtistName",
      "goalK": 100
    }
  ],

  "events": [
    {
      "id": "unique-id",
      "name": "Event Name",
      "startDate": "2025-06-01",
      "endDate": "2025-06-03",
      "goalK": 200,
      "scope": "asia",
      "tags": [
        { "value": "#EventHashtag", "type": "hashtag" },
        { "value": "event keyword", "type": "keyword" }
      ]
    }
  ]
}
```

**scope** options:
- `"asia"` — 22 locations (Asia + Middle East + Worldwide)
- `"all64"` — 65 locations (all countries + Worldwide)

---

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `deploy.yml` | Every push to main | Deploys docs/ to GitHub Pages |
| `fetch.yml` | Every 30 min + manual | Fetches tweet_volume for all tags |
| `trends.yml` | Manual only | Scans trend rank by country for events |