/**
 * Turns the portfolio's own data into the text Munshi answers from. Pure: the caller reads
 * the files and this only formats, so it can be tested without a filesystem.
 */

export interface KnowledgeProject {
  title: string;
  order: number;
  kind: string;
  status: string;
  summary: string;
  highlights: string[];
  stack: string[];
  links?: { label: string; url: string }[];
}

export interface KnowledgeExperience {
  role: string;
  company: string;
  location: string;
  /** `YYYY-MM`. */
  start: string;
  /** `YYYY-MM`. Absent for a current role. */
  end?: string;
  summary: string;
  groups: { heading: string; points: string[] }[];
}

export interface KnowledgeInput {
  siteUrl: string;
  profile: {
    name: string;
    role: string;
    specialty: string;
    location: string;
    headline: string;
    lead: string;
    email: string;
    phone?: { display: string; href?: string };
    employer: string;
    resume: { href: string };
  };
  socials: readonly { label: string; url: string }[];
  about: readonly string[];
  focusAreas: readonly string[];
  skills: readonly { heading: string; items: readonly string[] }[];
  education: { degree: string; institution: string; location: string; period: string };
  projects: KnowledgeProject[];
  experience: KnowledgeExperience[];
  /** Hand-written Markdown from knowledge/facts.md. */
  facts: string;
}

/** About 7,000 tokens. Past this the prompt costs more and a small model starts losing detail. */
export const MAX_KNOWLEDGE_CHARS = 28_000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const name = month === undefined ? undefined : MONTHS[month - 1];
  if (!year || !name) throw new Error(`Expected a YYYY-MM date, got "${value}"`);
  return `${name} ${year}`;
}

/** YAML folded blocks and Markdown both leave stray whitespace. One space reads the same to a model. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${oneLine(item)}`).join('\n');
}

export function renderKnowledge(input: KnowledgeInput): string {
  const { profile, education } = input;

  // Newest role first, the order the page shows them. `YYYY-MM` sorts correctly as text.
  const experience = [...input.experience].sort((a, b) => b.start.localeCompare(a.start));
  const projects = [...input.projects].sort((a, b) => a.order - b.order);

  const sections: string[] = [
    [
      '# Profile',
      `Name: ${profile.name}`,
      `Role: ${profile.role}`,
      `Specialty: ${profile.specialty}`,
      `Location: ${profile.location}`,
      `Current employer: ${profile.employer}`,
      `Headline: ${oneLine(profile.headline)}`,
      `Summary: ${oneLine(profile.lead)}`,
    ].join('\n'),

    [
      '# Contact and links',
      `Email: ${profile.email}`,
      ...(profile.phone ? [`Phone: ${profile.phone.display}`] : []),
      `Portfolio: ${input.siteUrl}`,
      `Resume (PDF): ${new URL(profile.resume.href, input.siteUrl).href}`,
      ...input.socials.map((social) => `${social.label}: ${social.url}`),
    ].join('\n'),

    // The page text is first person. Labelled, so the model does not start speaking as Sourabh.
    ['# About (in his own words)', ...input.about.map(oneLine)].join('\n'),

    ['# Focus areas', bullets(input.focusAreas)].join('\n'),

    [
      '# Work experience',
      ...experience.map((job) =>
        [
          `## ${job.role}, ${job.company} (${job.location})`,
          `Dates: ${formatMonth(job.start)} to ${job.end ? formatMonth(job.end) : 'present'}`,
          oneLine(job.summary),
          ...job.groups.map((group) => `### ${group.heading}\n${bullets(group.points)}`),
        ].join('\n'),
      ),
    ].join('\n\n'),

    [
      '# Projects',
      ...projects.map((project) =>
        [
          `## ${project.title}`,
          `Type: ${project.kind}`,
          `Status: ${project.status}`,
          oneLine(project.summary),
          'Highlights:',
          bullets(project.highlights),
          `Technology: ${project.stack.join(', ')}`,
          ...(project.links ?? []).map((link) => `${link.label}: ${link.url}`),
        ].join('\n'),
      ),
    ].join('\n\n'),

    [
      '# Skills',
      ...input.skills.map((group) => `${group.heading}: ${group.items.join(', ')}`),
    ].join('\n'),

    [
      '# Education',
      `${education.degree}, ${education.institution}, ${education.location} (${education.period})`,
    ].join('\n'),

    ['# Additional facts', input.facts.trim()].join('\n'),
  ];

  return sections.join('\n\n');
}

/**
 * Problems that must stop a build: content that should never reach the model, or a record too
 * large to be worth sending on every request. Returns one message per problem.
 */
export function checkKnowledge(text: string, forbidden: readonly string[]): string[] {
  const problems: string[] = [];
  if (text.length > MAX_KNOWLEDGE_CHARS) {
    problems.push(`Knowledge is ${text.length} characters; the limit is ${MAX_KNOWLEDGE_CHARS}.`);
  }

  // Compared without spaces or punctuation, so "+91 89055 95681" also catches "8905595681".
  const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const haystack = squash(text);
  for (const term of forbidden) {
    const needle = squash(term);
    if (needle && haystack.includes(needle)) problems.push(`Knowledge contains "${term}".`);
  }

  if (/\b(TODO|TBD|FIXME)\b/.test(text)) problems.push('Knowledge contains an unfinished note.');
  return problems;
}
