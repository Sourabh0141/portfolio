/**
 * Everything personal and non-collection lives here. Edit this file (and the YAML in
 * `src/content`) to update the site — no component changes needed.
 */

export const profile = {
  name: 'Sourabh Sharma',
  initials: 'SS',
  role: 'Software Engineer',
  specialty: 'AI & backend systems',
  location: 'Jaipur, India',
  headline: 'I build the backend and AI services behind real-time products.',
  lead: 'Async Python APIs, event-driven messaging and model-serving microservices — from vision and speech models to RAG chatbots, taken from prototype to production.',
  email: 'sourabh.sharma0141@gmail.com',
  phone: { display: '+91 89055 95681', href: '+918905595681' },
  employer: 'Predusk Technology Pvt Ltd',
  /** Served from `public/resume/`. Replace the file, keep the name. */
  resume: { href: '/resume/Sourabh-Sharma-Resume.pdf', label: 'Resume (PDF)' },
} as const;

export const socials = [
  { id: 'github', label: 'GitHub', url: 'https://github.com/Sourabh0141' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/in/sourabh-sharma-3221932b5/',
  },
] as const;

export const seo = {
  title: 'Sourabh Sharma — Software Engineer, AI & Backend Systems',
  description:
    'Portfolio of Sourabh Sharma, a Jaipur-based software engineer building async Python backends, real-time messaging and AI/ML services — including Flare, a voice-first AI companion on Cloudflare.',
  ogImage: '/og.png',
  ogImageAlt: 'Sourabh Sharma — Software Engineer, AI and backend systems',
} as const;

export const nav = [
  { href: '#work', label: 'Work' },
  { href: '#experience', label: 'Experience' },
  { href: '#skills', label: 'Skills' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
] as const;

export const focusAreas = [
  'Async Python and FastAPI services',
  'Real-time messaging with MQTT and RabbitMQ',
  'Vision, speech and LLM pipelines in production',
  'Edge deployments on Cloudflare',
] as const;

export const about = [
  'I’m a software engineer at Predusk Technology in Jaipur, working across Python backends and applied AI. Day to day that means FastAPI microservices, real-time messaging, and putting vision, speech and language models into production.',
  'I like replacing the fragile parts of a system — polling, blocking calls, a full browser per request — with architecture that holds up under load. Outside work I build and ship small products end to end, such as Flare, a voice companion that runs on Cloudflare’s edge.',
] as const;

export const skills = [
  {
    heading: 'Languages',
    items: ['Python', 'JavaScript', 'SQL'],
  },
  {
    heading: 'AI & machine learning',
    items: [
      'LangGraph',
      'Gemini API',
      'vLLM',
      'RAG',
      'YOLO11x',
      'SAM 2.1',
      'BoT-SORT',
      'OCR',
      'Kokoro TTS',
      'Faster-Whisper',
    ],
  },
  {
    heading: 'Backend',
    items: ['FastAPI', 'Celery', 'REST APIs', 'JWT'],
  },
  {
    heading: 'Messaging & real-time',
    items: ['MQTT (EMQX)', 'RabbitMQ', 'WebSockets'],
  },
  {
    heading: 'Data & storage',
    items: ['PostgreSQL', 'asyncpg', 'Redis', 'SQLite', 'MinIO', 'S3'],
  },
  {
    heading: 'Frontend',
    items: ['Next.js', 'Streamlit', 'HTML & CSS'],
  },
  {
    heading: 'DevOps & automation',
    items: ['Docker', 'Linux deployments', 'Git & GitHub', 'Playwright', 'Selenium'],
  },
] as const;

export const education = {
  degree: 'Bachelor of Computer Applications (BCA)',
  institution: 'SSG Pareek College, University of Rajasthan',
  location: 'Jaipur, India',
  period: '2022 – 2025',
} as const;
