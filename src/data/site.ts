/**
 * Everything personal and non-collection lives here. Edit this file (and the YAML in
 * `src/content`) to update the site — no component changes needed.
 */

export const profile = {
  name: 'Sourabh Sharma',
  initials: 'SS',
  role: 'Software Engineer',
  specialty: 'Backend Systems, Applied AI & Cloud Architecture',
  location: 'Jaipur, India',
  headline: 'I architect distributed backends, real-time messaging, and production AI systems.',
  lead: 'From leading cross-cloud client platforms and event-driven data pipelines to deploying vision, speech, and edge AI companions — engineered for low latency, zero blocking I/O, and resilience under load.',
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
  title: 'Sourabh Sharma — Software Engineer, Backend Systems & Applied AI',
  description:
    'Portfolio of Sourabh Sharma, a software engineer leading cross-cloud client platforms and architecting async Python backends, real-time messaging (RabbitMQ, MQTT), and production AI systems — including Caliber, Labelfort, Digilekh, and Flare.',
  ogImage: '/og.png',
  ogImageAlt: 'Sourabh Sharma — Software Engineer, Backend Systems & Applied AI',
} as const;

export const nav = [
  { href: '#work', label: 'Work' },
  { href: '#experience', label: 'Experience' },
  { href: '#skills', label: 'Skills' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
] as const;

export const focusAreas = [
  'High-throughput async Python & FastAPI microservices',
  'Event-driven architectures with RabbitMQ and MQTT',
  'Computer vision, speech & RAG pipelines in production',
  'Cross-cloud & serverless edge deployments (GCP, AWS, Cloudflare)',
] as const;

export const about = [
  'I’m a software engineer at Predusk Technology in Jaipur, leading offshore client engineering and architecting distributed backend and applied AI systems. My day-to-day work spans asynchronous Python microservices, real-time event streaming with RabbitMQ and MQTT, and putting production vision, speech, and retrieval models into high-volume workflows across Google Cloud and AWS.',
  'I focus on engineering out the fragile parts of a system — eliminating synchronous bottlenecks with non-blocking I/O (asyncpg, aioboto3), replacing poll loops with push-based broker topologies, and enforcing strict multi-tenancy and data integrity. Outside client work, I build end-to-end systems such as ArchiveLens (historical newspaper layout segmentation and search) and Flare, an edge-native voice companion running on Cloudflare.',
] as const;

export const skills = [
  {
    heading: 'Languages',
    items: ['Python', 'TypeScript', 'JavaScript', 'SQL'],
  },
  {
    heading: 'AI & machine learning',
    items: [
      'vLLM',
      'Surya OCR',
      'SAM 2.1',
      'YOLO11x',
      'BoT-SORT',
      'Faster-Whisper',
      'Kokoro TTS',
      'Qdrant',
      'RAG Pipelines',
      'LangGraph',
      'Gemini API',
    ],
  },
  {
    heading: 'Backend & APIs',
    items: [
      'FastAPI',
      'SQLAlchemy (Async)',
      'Celery',
      'Pydantic v2',
      'Hono',
      'Uvicorn',
      'REST APIs',
      'JWT & OAuth2',
    ],
  },
  {
    heading: 'Messaging & real-time',
    items: [
      'RabbitMQ (Web-STOMP)',
      'MQTT (EMQX / Web-MQTT)',
      'WebSockets',
      'Server-Sent Events (SSE)',
      'aio-pika',
    ],
  },
  {
    heading: 'Data & storage',
    items: [
      'PostgreSQL (asyncpg)',
      'Redis',
      'BigQuery',
      'OpenSearch',
      'MinIO & S3 (aioboto3)',
      'DynamoDB',
      'Cloudflare D1',
    ],
  },
  {
    heading: 'Cloud & infrastructure',
    items: [
      'Terraform',
      'Google Cloud (Functions, Workflows)',
      'AWS (CDK, Lambda, S3, Cognito)',
      'Cloudflare (Workers, Pages, R2)',
      'Docker',
      'Linux',
    ],
  },
  {
    heading: 'Automation & testing',
    items: ['Playwright', 'Pytest', 'Vitest', 'GitHub Actions CI/CD', 'FFmpeg'],
  },
] as const;

export const education = {
  degree: 'Bachelor of Computer Applications (BCA)',
  institution: 'SSG Pareek College, University of Rajasthan',
  location: 'Jaipur, India',
  period: '2022 – 2025',
} as const;
