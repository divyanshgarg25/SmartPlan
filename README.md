<div align="center">
  
# ⚡ SmartPlan
**AI-Driven Adaptive Productivity Planner**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

*A full-stack Progressive Web Application that acts as a personalized AI productivity assistant, dynamically generating time-blocked schedules to help users optimize deep work and avoid burnout.*

</div>

---

## ✨ Key Features

- 🧠 **AI-Powered Scheduling Engine:** Automates daily planning and monitors task completion, streaming personalized, time-blocked schedules in real-time via Server-Sent Events (SSE).
- 🔄 **Continuous Uptime Architecture:** Architected with an LLM circuit-breaker (routing between Gemini and Groq) with custom algorithmic fallback, guaranteeing 100% schedule generation uptime during third-party API outages.
- ⚡ **Behavioral Adaptation:** A dynamic scheduling system that actively tracks 7-day task completion rates, maximizing output by routing complex tasks around identified periods of low productivity (biological slumps).
- 🛡️ **Enterprise-Grade Security:** Multi-tenant user data is strictly secured with Postgres Row-Level Security (RLS). API budget quotas are protected by atomic SQL transactions (`UPSERT`) to completely eliminate database race conditions.
- 📱 **Progressive Web App (PWA):** Installable on iOS, Android, and Desktop with offline caching via Service Workers.

---

## 🛠️ Technical Stack

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + Glassmorphism UI
- **State Management:** Zustand + React Query
- **PWA:** `vite-plugin-pwa` (NetworkFirst caching strategy)

### Backend & AI
- **Compute Layer:** Vercel Edge Runtime (Node.js)
- **Streaming:** Server-Sent Events (SSE) for sub-second perceived latency
- **AI Models:** Google Gemini (Primary) & Groq (Circuit-breaker Fallback)

### Database & Auth (Backend-as-a-Service)
- **Provider:** Supabase
- **Database:** PostgreSQL (with heavily utilized RPC functions)
- **Security:** Strict Row-Level Security (RLS) policies based on `auth.uid()`
- **Background Jobs:** Supabase Edge Functions (Cron pollers)

---

## 🏗️ System Architecture Highlights

### 1. The LLM Circuit Breaker
To prevent AI hallucination or API timeouts from breaking the user experience, SmartPlan utilizes a multi-tiered fallback system:
1. **Tier 1:** Gemini API (Primary generation)
2. **Tier 2:** Groq API (High-speed fallback if Gemini fails)
3. **Tier 3:** Deterministic Algorithmic Fallback (A greedy task-packing algorithm that runs locally if all AI APIs go down, ensuring 100% uptime).

### 2. Atomic Rate Limiting
To prevent malicious users from spamming the "Generate" button and bypassing the 30-generations-per-day limit, the rate limiter does not use a vulnerable "Read-Modify-Write" JavaScript flow. Instead, it relies on a custom Postgres RPC utilizing `INSERT ... ON CONFLICT DO UPDATE`. This guarantees atomic, transaction-level locking, making Race Conditions mathematically impossible.

---

## 🚀 Local Development Setup

To run this project locally, you will need a Supabase account and API keys for Gemini/Groq.

**1. Clone the repository**
```bash
git clone https://github.com/divyanshgarg25/SmartPlan.git
cd SmartPlan
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure Environment Variables**
Rename `.env.example` to `.env.local` and add your API keys:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

**4. Run the development server**
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

<div align="center">
  <i>Designed and engineered for maximum productivity.</i>
</div>
