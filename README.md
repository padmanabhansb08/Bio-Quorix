# BioQuorix

BioQuorix is a browser-based biotechnology learning assistant built as a single-page web app. It combines guided lesson generation, quizzes, flashcards, analytics, and an AI tutor into one local-first study experience for school and university learners.

The runnable app lives in [`bio qurix/`](./bio%20qurix/).

## What it does

- Personalized onboarding for school-level and university-level biotech learners
- Diagnostic quiz to estimate weak areas and shape the study path
- Topic-based lesson modules with optional AI generation through Ollama
- Quiz engine with explanations, score tracking, and progress history
- Flashcard decks with spaced-repetition style review scheduling
- AI tutor chat with selectable personas and local model switching
- Analytics dashboard with charts, strengths, weaknesses, streaks, XP, and leaderboard
- Local profile storage with export options and no external database requirement

## Tech stack

- HTML, CSS, and vanilla JavaScript
- Node.js static server
- Chart.js for analytics charts
- Marked for markdown rendering
- Canvas Confetti for celebratory UI feedback
- Optional Ollama integration at `http://localhost:11434`

## Project layout

```text
.
+-- bio qurix/
|   +-- public/
|   |   +-- index.html
|   |   +-- css/style.css
|   |   +-- js/app.js
|   |   +-- js/data.js
|   |   +-- assets/logo.jpg
|   +-- server.js
|   +-- README.md
```

## Run locally

1. Open a terminal in the repo root.
2. Move into the app folder:

```powershell
cd "bio qurix"
```

3. Start the local server:

```powershell
node server.js
```

4. Open `http://localhost:8000/` in your browser.

There is no `package.json` setup in this repo right now, so no dependency install step is required for the current server.

## Optional Ollama setup

BioQuorix can run with built-in fallback content, but the AI-powered lesson, quiz, chat, and flashcard features work best when Ollama is running locally.

1. Install Ollama on your machine.
2. Start Ollama so the API is available at `http://localhost:11434`.
3. Pull one of the models supported by the UI, for example:

```powershell
ollama pull gemma2:9b
```

You can switch models from inside the app. The current UI includes options such as `gemma2:9b`, `gemma4`, `llama3`, and `mistral`.

## Data and persistence

- User accounts and progress are stored in browser `localStorage`
- Quiz results, flashcards, XP, and activity history stay on the local device
- Export actions are available from the UI for notes and user data

## Notes

- This project currently uses local-only storage and demo-style authentication
- If Ollama is unavailable, several features fall back to bundled content, while some AI generation paths may be limited
- The repository is currently organized with the actual app inside the `bio qurix/` folder
