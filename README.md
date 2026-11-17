# Saff Tracker

A personal daily tracker: tap what you did today, then review it by week, by month and on a dashboard.

- **Today**: one tap per activity, with arrows to fill in earlier days.
- **Week**: a seven-day grid with counts and weekly targets.
- **Month**: a calendar with a dot per activity, and totals compared with the previous month.
- **Dashboard**: headline numbers, target rings, sessions per week, a daily heatmap and the activity mix.
- **Settings**: add, rename, reorder or delete what you track, set weekly targets, and save or restore a backup file.

Data is stored only in the browser on the device you use. Use **Settings → Save backup** to keep a copy.

## Running it

It is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server:

    python3 -m http.server 8000

Then open http://localhost:8000. Hosted over HTTPS (for example GitHub Pages), it can be added to a phone's home screen and works offline.
