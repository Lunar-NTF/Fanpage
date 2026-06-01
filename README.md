# 🐼🌙🐥 Fan Club Hashtag Tracker
### GitHub Pages + Actions edition — no extra accounts needed

---

## How it works

```
GitHub Actions (cron)          GitHub Pages (your site)
       │                               │
  Every 30 min:               Reads JSON files:
  fetch.js runs               config.json
  saves snapshots.json  ────► data/snapshots.json
  commits back to repo        data/trends.json
```

Your API key lives **only** as a GitHub Secret — never in the code.

---

## Setup (one time, ~5 minutes)

### 1. Fork or upload this repo to GitHub
- Go to github.com → New repository → name it `fantracker`
- Upload all these files, keeping the folder structure

### 2. Enable GitHub Pages
- Go to your repo → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: `main` / folder: `/docs`
- Click Save
- Your site will be live at: `https://YOUR_USERNAME.github.io/fantracker`

### 3. Add your RapidAPI key as a Secret
- Go to your repo → **Settings** → **Secrets and variables** → **Actions**
- Click **New repository secret**
- Name: `RAPIDAPI_KEY`
- Value: your RapidAPI key (the one you already have)
- Click **Add secret**

### 4. Edit config.json
- Open `config.json` in GitHub (click the file → pencil icon to edit)
- Replace the placeholder hashtags/keywords with your real ones
- Set your goals (in thousands — e.g. `100` = 100K tweets)
- Add your events with tags and dates
- Commit the changes

### 5. Run the first fetch manually
- Go to **Actions** → **Fetch counts** → **Run workflow**
- This fetches your first data point immediately
- After that it runs automatically every 30 minutes

---

## Running a trend scan (manual, uses API quota)

1. Go to **Actions** → **Scan trends** → **Run workflow**
2. Optionally add a note (e.g. "Fanmeeting Bangkok")
3. Click **Run workflow**
4. Wait ~2 min for it to finish
5. Results appear on the **By country** tab of your dashboard

---

## Editing config.json

Open `config.json` in GitHub and edit directly. Here's the full structure:

```json
{
  "title": "My Fan Club ✦",
  "rapidApiKey": "leave this empty — key is in GitHub Secrets",

  "permSlots": [
    {
      "id": "perm-0",
      "hashtag": "#ArtistName",
      "keyword": "ArtistName",
      "goalK": 100
    },
    {
      "id": "perm-1",
      "hashtag": "#ArtistName2",
      "keyword": "ArtistName2",
      "goalK": 50
    }
  ],

  "events": [
    {
      "id": "evt-1",
      "name": "Fanmeeting Bangkok",
      "startDate": "2025-06-01",
      "endDate": "2025-06-03",
      "goalK": 200,
      "scope": "asia",
      "tags": [
        { "value": "#FanmeetingBKK",   "type": "hashtag" },
        { "value": "#ArtistNameBKK",   "type": "hashtag" },
        { "value": "Fanmeeting Bangkok","type": "keyword" }
      ]
    }
  ]
}
```

**scope** can be `"asia"` (22 locations) or `"all64"` (65 locations).

To add a new event: copy the event block, change the id/name/tags/dates, commit.
To remove an event: delete its block, commit.

---

## File structure

```
fantracker/
├── .github/
│   └── workflows/
│       ├── fetch.yml      ← runs every 30 min (auto)
│       └── trends.yml     ← manual trend scan
├── docs/                  ← GitHub Pages serves this
│   ├── index.html
│   ├── style.css
│   └── app.js
├── scripts/
│   ├── fetch.js           ← fetches tweet counts
│   └── trends.js          ← scans trend rank by country
├── data/
│   ├── snapshots.json     ← auto-updated by fetch.js
│   └── trends.json        ← updated by trends.js
├── config.json            ← YOU EDIT THIS
├── package.json
└── README.md
```

---

## Quota usage

- **fetch.js** (every 30 min): 1 request per tracked tag
  - 2 perm slots × 2 tags = 4 requests per run
  - 4 event tags = 4 more requests per run
  - Total: ~8 req / 30 min = ~11,500 req/month
  - Vikhorev API gives 1,000/month free → enough for ~125 runs → ~2.5 days
  - **Solution**: reduce fetch frequency in fetch.yml (e.g. `*/60` = hourly = 720 runs/month)

- **trends.js** (manual only): 1 request per country per tag
  - Asia mode: 22 × (number of event tags)
  - All 64 mode: 65 × (number of event tags)

---

## Changing fetch frequency

Edit `.github/workflows/fetch.yml` and change the cron:
```yaml
- cron: '*/30 * * * *'   # every 30 min (default)
- cron: '0 * * * *'      # every hour
- cron: '0 */2 * * *'    # every 2 hours
- cron: '0 */6 * * *'    # every 6 hours
```
