# 🎴 Full-Stack AI Flashcard Generator & Study Pipeline

An edge-optimized SaaS application engineered to process unstructured notes, text, and study material into semantic active-recall flashcard decks using high-throughput open-weights LLMs via Groq.

**🔗 Live Demo:** [ai-flashcard-generator-rosy.vercel.app](https://ai-flashcard-generator-rosy.vercel.app)

---

## 🏗️ System Architecture

Built on the Next.js App Router with edge-based security rules, asynchronous request handling, and persistent user authentication.

```mermaid
graph TD
    A[User Input / Study Notes] --> B[Next.js Edge Middleware]
    B -->|Rate Limit Checks / IP Tracking| C[API Generation Route]
    C -->|Length Check & Text Chunking| D[Groq API Engine]
    D -->|Structured JSON Response| E[Supabase Auth & Database]
    E --> F[Vercel Global Edge Network / UI]
