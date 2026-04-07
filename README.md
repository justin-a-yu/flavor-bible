# Flavor Bible Explorer

An interactive web app for home cooks to explore flavor relationships and find cooking inspiration, powered by the data from *The Flavor Bible*.

---

## Project Structure

```
flavor-bible/
├── app/                  # React + Vite web application (production)
│   └── src/
│       ├── data/         # Generated data file (do not edit manually)
│       ├── components/   # UI components
│       ├── pages/        # Page-level components
│       ├── store/        # Zustand global state
│       └── utils/        # Shared utilities
├── data/
│   └── flavors.json      # Source of truth for all ingredient data
├── docs/                 # Product and design documentation
├── mockup/               # Vanilla JS canvas prototype (reference only)
├── plans/                # Engineering plans and code generation prompts
└── scripts/              # Data processing scripts
```

---

## Running the App Locally

```bash
cd app
npm install      # first time only
npm run dev      # starts dev server at http://localhost:5173
```

---

## Updating the Data

The app reads from `app/src/data/flavors_data.js`, which is generated from the source data at `data/flavors.json`.

**Never edit `app/src/data/flavors_data.js` directly** — it will be overwritten the next time the script runs.

To update the data:

1. Edit `data/flavors.json` (or re-run the parser scripts in `scripts/`)
2. Regenerate the app data file:
   ```bash
   python3 scripts/build_data_js.py
   ```
3. Commit both `data/flavors.json` and `app/src/data/flavors_data.js`

---

## Deploying to Vercel

The app is a standard Vite + React project. To deploy:

1. Push changes to the `main` branch on GitHub
2. Vercel detects the push, runs `npm run build` inside `app/`, and deploys automatically

If setting up Vercel for the first time:
- Connect the GitHub repo at vercel.com
- Set the **root directory** to `app`
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

---

## Documentation

| File | Description |
|---|---|
| `docs/mvp_user_stories.md` | User stories and acceptance criteria |
| `docs/task_management_unit.md` | Consolidated task management unit |
| `docs/task_component_model.md` | Component model and architecture |
| `docs/prompts.md` | Product decisions and interaction design log |
| `docs/tasks.md` | Project task tracker |
| `plans/code_generation_prompts.md` | Phased build prompts |
