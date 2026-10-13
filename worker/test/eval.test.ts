import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/munshi';
import rawCases from '../eval/cases.json';
import { caseMessages, scoreCase, summarize, validateCases } from '../eval/score';
import type { CaseResult, EvalCase } from '../eval/score';
import { KNOWLEDGE } from '../src/generated/knowledge';
import { parseChatRequest } from '../src/validate';

const cases = rawCases as EvalCase[];

describe('evaluation cases', () => {
  it('are well formed', () => {
    expect(validateCases(cases)).toEqual([]);
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it('are requests the Worker would accept', () => {
    for (const evalCase of cases) {
      const messages = caseMessages(evalCase);
      expect(messages.length).toBeLessThanOrEqual(LIMITS.messages);
      expect(() => parseChatRequest({ messages }), evalCase.id).not.toThrow();
    }
  });

  // If the portfolio content changes, a factual case can start demanding something the model
  // was never told. This fails here, for free, instead of in a paid evaluation run.
  it('only expect facts that the knowledge base contains', () => {
    const knowledge = KNOWLEDGE.toLowerCase();
    for (const evalCase of cases.filter((entry) => entry.category === 'factual')) {
      for (const group of evalCase.mustInclude ?? []) {
        const known = group.some((phrase) => knowledge.includes(phrase.toLowerCase()));
        expect(known, `${evalCase.id}: none of [${group.join(', ')}] is in the knowledge`).toBe(
          true,
        );
      }
    }
  });
});

describe('scoreCase', () => {
  const base: EvalCase = { id: 'c', category: 'factual', question: 'q' };

  it('needs one phrase from every group, ignoring case', () => {
    const evalCase = { ...base, mustInclude: [['Nov', 'November'], ['2025']] };
    expect(scoreCase(evalCase, 'He started in november 2025.').passed).toBe(true);
    const missing = scoreCase(evalCase, 'He started in 2025.');
    expect(missing.passed).toBe(false);
    expect(missing.reasons).toEqual(['missing one of: Nov | November']);
  });

  it('fails on a forbidden pattern, an empty answer or too many words', () => {
    const evalCase = { ...base, mustNotMatch: ['[$]\\s*\\d'], maxWords: 5 };
    expect(scoreCase(evalCase, 'About $ 90k').passed).toBe(false);
    expect(scoreCase(evalCase, '').reasons).toContain('empty answer');
    expect(scoreCase(evalCase, 'one two three four five six').reasons).toEqual([
      '6 words, limit 5',
    ]);
    expect(scoreCase(evalCase, 'I do not have that.').passed).toBe(true);
  });
});

describe('summarize', () => {
  const result = (category: CaseResult['category'], passed: boolean): CaseResult => ({
    id: 'x',
    category,
    passed,
    reasons: [],
  });

  it('tolerates one factual miss in ten', () => {
    const results = [
      ...Array.from({ length: 9 }, () => result('factual', true)),
      result('factual', false),
      result('injection', true),
    ];
    expect(summarize(results).accepted).toBe(true);
  });

  it('rejects two factual misses in ten', () => {
    const results = [
      ...Array.from({ length: 8 }, () => result('factual', true)),
      result('factual', false),
      result('factual', false),
    ];
    expect(summarize(results).accepted).toBe(false);
  });

  it('rejects any safety failure', () => {
    for (const category of ['gap', 'injection', 'off_topic', 'confidentiality'] as const) {
      const summary = summarize([result('factual', true), result(category, false)]);
      expect(summary.accepted).toBe(false);
      expect(summary.byCategory[category]).toEqual({ passed: 0, total: 1 });
    }
  });
});
