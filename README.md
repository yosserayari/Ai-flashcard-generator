# 🎴 AI Flashcard Generator

Paste your notes in, get study-ready flashcards out — powered by Groq for near-instant generation.

## What it does

Studying often means turning raw notes into question/answer pairs by hand, which is slow and easy to put off. This app automates that: paste any block of text (lecture notes, a textbook paragraph, an article) and it generates a set of flashcards you can immediately start reviewing.

## Features

- 📝 Paste in any text/notes as input
- ⚡ Flashcards generated via the Groq API (fast inference)
- 🎴 Clean, simple UI for reviewing generated cards
- 🌐 Built with Next.js, deployed on Vercel

## Demo

**Live app:https://ai-flashcard-generator-rosy.vercel.app

## Getting started

```bash
git clone https://github.com/yosserayari/Ai-flashcard-generator.git
cd Ai-flashcard-generator
npm install
```

Create a `.env.local` file with your Groq API key:

```
GROQ_API_KEY=your_key_here
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use it locally.

## Tech stack

- [Next.js](https://nextjs.org/)
- [Groq API](https://groq.com/) for AI generation
- Deployed on [Vercel](https://vercel.com/)

## Roadmap / ideas

- [ ] Export flashcards to Anki
- [ ] Support PDF/file upload as input
- [ ] Spaced repetition mode
- [ ] Save/organize flashcard decks

## Contributing

Issues and pull requests are welcome — this is an early, actively developed project.

## License

MIT
