# Nova Gaming Network — Scrims Platform v3.0

A complete, production-ready, role-gated web platform for managing and exporting Call of Duty Mobile Battle Royale scrims statistics.

## Stack Overview
- **Frontend**: Vanilla HTML5/CSS3/ES6 Modules + Vite
- **Backend/Auth**: Supabase (PostgreSQL + Auth + RLS)
- **Functions**: Vercel Serverless
- **Design**: Dark Military-Esports (Orbitron / Barlow)

## Core Features
1. **Role-Based Access Control**: Strict access tiers (Owner, Admin, Mod) with Supabase Row-Level Security.
2. **AI Vision OCR**: Vercel serverless pipeline utilizing Gemini and Groq Vision APIs with fallback mechanisms to automatically parse match results from screenshots.
3. **GFX Generator Engine**: Client-side rendering pipeline utilizing `html2canvas` and the `FontFace` API to export high-res graphic templates for Discord/Socials.

## Deployment Setup

### 1. Database Initialization
Run the schema in your Supabase SQL Editor to provision tables, indexes, and RLS policies:
`supabase-schema.sql`

### 2. Environment Variables
Add these to your Vercel project configuration:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
OWNER_EMAIL=your_email@example.com

GEMINI_API_KEY=key_1
GEMINI_API_KEY_2=key_2
GROQ_API_KEY=key_3
```

### 3. First Login (Owner Bootstrap)
The platform is completely closed and role-gated.
1. Deploy the site to Vercel.
2. Navigate to `/login.html`.
3. Sign up using the exact email specified in `OWNER_EMAIL`.
4. The backend will automatically bootstrap you with the `owner` role.
5. From the dashboard, navigate to User Management to invite and assign roles to your staff.

## Local Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```
