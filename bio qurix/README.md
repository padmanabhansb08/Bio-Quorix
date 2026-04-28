# BioQuorix

BioQuorix is a browser-based biotechnology learning assistant built as a single-page web app. It is designed for school and university learners who want a guided, interactive study tool with lessons, quizzes, flashcards, analytics, and an AI tutor.

## Features

- Personalized onboarding with school and university learning tracks
- Diagnostic quiz to identify weak areas
- Topic-based lesson generation with Ollama support
- Quiz engine with explanations and score tracking
- Flashcards with spaced-repetition style review flow
- AI tutor chat with selectable personas and model switching
- Analytics dashboard with charts, streaks, leaderboard, and XP
- Local profile export and browser-based persistence

## Stack

- Vanilla HTML, CSS, and JavaScript
- Node.js static server
- Chart.js
- Marked
- Canvas Confetti
- Optional Ollama local API integration

## Project structure

```text
bio qurix/
+-- public/
|   +-- index.html
|   +-- css/style.css
|   +-- js/app.js
|   +-- js/data.js
|   +-- assets/logo.jpg
+-- server.js
```

## Run locally

```powershell
node server.js
```

Then open `http://localhost:8000/`.

## Ollama

For the best experience, run Ollama locally at `http://localhost:11434` and load one of the models exposed in the UI, such as `gemma2:9b`, `gemma4`, `llama3`, or `mistral`.

If Ollama is not available, BioQuorix still works with bundled fallback content for several learning flows.

## Persistence

User accounts, learning progress, flashcards, and activity data are stored in browser `localStorage`, so this version is best suited for demos, local experiments, and offline-friendly prototyping.
