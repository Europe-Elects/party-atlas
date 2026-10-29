# European Party Atlas

An interactive explorer for the [Europe Elects Party & Alliance Database](https://docs.google.com/spreadsheets/d/1MAdqaO7SU4uhjjbaDoTGdj7DPZ_NuWvjTnAcrUnTHY8/edit?gid=0), hosted on GitHub Pages and refreshed from the sheet every day.

## What's in it

- **Map** – parties per country (log scale); click a country to filter every view.
- **Europarty membership** – current members per European party, with “interest to join” shown hatched (toggle it off in the filter bar).
- **Ideology × EU integration** – every party as a dot: left–right by ideological orientation, up–down by EU-integration stance, scattered to avoid overlap. Fill = Europarty, thick ring = EP group.
- **Affiliations** (EP group, PACE, international federations, Nordic Council, CoR, CLaRA, CIS, Benelux).
- **Table** – sortable and searchable; click a row for every field plus the entity's version history (e.g. a party that realigned).
- Filters are kept in the URL, so a filtered view can be shared as a link. There is no download option.

Columns from *Documented Links…* onward (Orientation, CEEGLA, LIBSEEN, Other International Affiliations, Date Enter, Date Exit, Note, Latest) and the *Europe Elects European Parliament Seat Projection Assignment* column are deliberately excluded — the Action strips them before publishing.

## Set up (about 2 minutes)

1. Create a new GitHub repository and push these files to the `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Go to **Actions → Refresh data & deploy → Run workflow** (or just push a commit).

The site appears at `https://<your-user>.github.io/<repo>/`. After that it rebuilds on every push and daily at 04:17 UTC.

The Google Sheet must stay viewable by “anyone with the link” for the Action to download it.

## Files

| File | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | The dashboard (D3, TopoJSON, PapaParse from cdnjs; country shapes from world-atlas) |
| `.github/workflows/deploy.yml` | Downloads the sheet as CSV, drops ignored columns, publishes to Pages |
| `data/sample.csv` | A small sample used only if the full data can't be loaded |

## Local preview

```sh
python3 -m http.server
```

Then open http://localhost:8000. Without a `data/parties.csv` it tries the live sheet, then falls back to the sample.

## Notes

- EP groups use their conventional colours; every bar is also labelled, and leanings are marked with hatching rather than colour alone.
- Status defaults to **active**; switch to *All statuses* to include realigned and older versions.
- To track another tab of the spreadsheet, change `GID` in the workflow.
