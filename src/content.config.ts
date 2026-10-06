/**
 * Contract for portfolio content. Astro checks every YAML file against these
 * schemas during dev and build, and generates the types the page sections use.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** A public link. `url` must be absolute; a relative path fails validation. */
const link = z.object({
  label: z.string(),
  url: z.url(),
});

/** Work section. One file per project in `src/content/projects`. */
const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** Display order on the page, lowest first. */
    order: z.number().int(),
    /** Category label shown above the title. */
    kind: z.string(),
    /** Where it runs or who owns it, for example "Predusk · Production". */
    status: z.string(),
    summary: z.string(),
    highlights: z.array(z.string()).min(1),
    stack: z.array(z.string()).min(1),
    /** Omitted in YAML when the project has no public URL. */
    links: z.array(link).default([]),
    /** Featured projects use the larger card. Defaults to false. */
    featured: z.boolean().default(false),
  }),
});

/** Experience section. One file per role in `src/content/experience`. */
const experience = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/experience' }),
  schema: z.object({
    role: z.string(),
    company: z.string(),
    location: z.string(),
    /** `YYYY-MM`, so a string sort is also chronological. */
    start: z.string().regex(/^\d{4}-\d{2}$/),
    /** `YYYY-MM`. Omit for a role that is still current. */
    end: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    summary: z.string(),
    groups: z
      .array(
        z.object({
          heading: z.string(),
          points: z.array(z.string()).min(1),
        }),
      )
      .min(1),
  }),
});

export const collections = { projects, experience };
