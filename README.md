# Quorix AI - Multi-Subject AI Learning Platform

Quorix AI is a Node.js, SQLite, HTML/CSS/JavaScript learning platform with a local Ollama-powered AI tutor. It supports subject-aware lessons, quizzes, flashcards, study notes, activity tracking, and authenticated user profiles.

## Features

- JWT signup/login and user profile storage
- Subject, topic, and difficulty selection saved in localStorage
- Quorix AI Tutor through local Ollama
- AI-generated lessons, quizzes, flashcards, and study notes
- Quiz history, flashcards, activity logging, XP, and progress analytics
- Safe SQLite migrations that preserve existing users and learning data

## Supported Subjects

Biology, Physics, Chemistry, Mathematics, Computer Science, English, History, Geography, Economics, Commerce, Accounting, Political Science, Psychology, Sociology, Environmental Science, General Knowledge, and Exam Preparation.

## Setup

```bash
npm install
npm start
```

Open the app at:

```text
http://localhost:8000
```

## Ollama Requirement

Install and run Ollama locally, then make sure the `llama3` model is available:

```bash
ollama run llama3
```

## Environment Variables

Create a `.env` file from `.env.example` and set:

```text
PORT=8000
JWT_SECRET=your_secret_here
OLLAMA_URL=http://localhost:11434/api/generate
```

Do not commit `.env`, database files, or `node_modules`.
