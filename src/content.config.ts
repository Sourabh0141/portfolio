import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const link = z.object({
  label: z.string(),
  url: z.url(),
});

const projects = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    /** Sort position on the page, ascending. */
    order: z.number().int(),
    /** Short category label shown above the title. */
    kind: z.string(),
    /** Where it runs / who owns it, e.g. "Predusk · Production". */
    status: z.string(),
    summary: z.string(),
    highlights: z.array(z.string()).min(1),
    /** Ordered data-flow steps rendered as a diagram. */
    flow: z.array(z.string()).min(3),
    stack: z.array(z.string()).min(1),
    links: z.array(link).default([]),
    /** The first featured project gets a larger card. */
    featured: z.boolean().default(false),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/experience' }),
  schema: z.object({
    role: z.string(),
    company: z.string(),
    location: z.string(),
    /** `YYYY-MM` */
    start: z.string().regex(/^\d{4}-\d{2}$/),
    /** `YYYY-MM`; omit for a current role. */
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
