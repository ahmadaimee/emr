import type { Expr, Finding, JsonValue, RuleDefinition, Severity } from './ast';
import type { ClaimFacts } from './facts';

/**
 * Safe interpreter for `grove.rule/v1`.
 *
 * Every operator is a switch case over plain data. There is no dynamic dispatch, no
 * property access on prototypes (paths are walked with own-property checks), and
 * regular expressions are compiled once per rule with a length cap. A hostile rule
 * definition can produce a wrong answer; it cannot execute code or read outside facts.
 */

type Env = Map<string, JsonValue>;

export interface TenantRule {
  key: string;
  name: string;
  severity: Severity;
  definition: RuleDefinition;
  source?: string;
}

export function evaluateRule(rule: TenantRule, facts: ClaimFacts): Finding[] {
  const def = rule.definition;
  const root = facts as unknown as JsonValue;
  const findings: Finding[] = [];
  const regexCache = new Map<string, RegExp>();

  const emit = (env: Env, lineIndex?: number) => {
    const evidence: Record<string, JsonValue> = {};
    for (const [k, v] of env) evidence[k] = v;
    findings.push({
      ruleKey: rule.key,
      ruleName: rule.name,
      severity: rule.severity,
      message: interpolate(def.message, root, env),
      path: def.path?.replace('{{lineIndex}}', String(lineIndex ?? '')),
      lineNumber: lineIndex !== undefined ? facts.lines[lineIndex]?.lineNumber : undefined,
      suggestedFix: def.suggestedFix
        ? { ...def.suggestedFix, target: def.suggestedFix.target?.replace('{{lineIndex}}', String(lineIndex ?? '')) }
        : undefined,
      evidence,
      source: rule.source ?? 'tenant',
    });
  };

  if (def.scope === 'claim') {
    const env: Env = new Map();
    if (truthy(evaluate(def.when, root, env, regexCache))) emit(env);
  } else {
    facts.lines.forEach((line, i) => {
      const env: Env = new Map([['line', line as unknown as JsonValue]]);
      if (truthy(evaluate(def.when, root, env, regexCache))) emit(env, i);
    });
  }
  return findings;
}

export function evaluate(e: Expr, root: JsonValue, env: Env, rx: Map<string, RegExp>): JsonValue {
  switch (e.op) {
    case 'lit':
      return e.value;
    case 'get':
      return getPath(root, e.path);
    case 'var': {
      const v = env.get(e.name) ?? null;
      return e.path ? getPath(v, e.path) : v;
    }
    case 'and':
      for (const a of e.args) if (!truthy(evaluate(a, root, env, rx))) return false;
      return true;
    case 'or':
      for (const a of e.args) if (truthy(evaluate(a, root, env, rx))) return true;
      return false;
    case 'not':
      return !truthy(evaluate(e.arg, root, env, rx));
    case 'eq':
      return looseEqual(evaluate(e.left, root, env, rx), evaluate(e.right, root, env, rx));
    case 'ne':
      return !looseEqual(evaluate(e.left, root, env, rx), evaluate(e.right, root, env, rx));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const l = evaluate(e.left, root, env, rx);
      const r = evaluate(e.right, root, env, rx);
      if (l === null || r === null) return false;
      const c = compare(l, r);
      return e.op === 'gt' ? c > 0 : e.op === 'gte' ? c >= 0 : e.op === 'lt' ? c < 0 : c <= 0;
    }
    case 'in': {
      const l = evaluate(e.left, root, env, rx);
      const r = evaluate(e.right, root, env, rx);
      return Array.isArray(r) && r.some((x) => looseEqual(x, l));
    }
    case 'contains': {
      const l = evaluate(e.left, root, env, rx);
      const r = evaluate(e.right, root, env, rx);
      if (Array.isArray(l)) return l.some((x) => looseEqual(x, r));
      if (typeof l === 'string' && typeof r === 'string') return l.includes(r);
      return false;
    }
    case 'matches': {
      const l = evaluate(e.left, root, env, rx);
      if (typeof l !== 'string') return false;
      let re = rx.get(e.pattern);
      if (!re) {
        re = new RegExp(e.pattern);
        rx.set(e.pattern, re);
      }
      return re.test(l);
    }
    case 'startsWith': {
      const l = evaluate(e.left, root, env, rx);
      const r = evaluate(e.right, root, env, rx);
      return typeof l === 'string' && typeof r === 'string' && l.startsWith(r);
    }
    case 'len': {
      const v = evaluate(e.arg, root, env, rx);
      return Array.isArray(v) || typeof v === 'string' ? v.length : 0;
    }
    case 'exists': {
      const v = evaluate(e.arg, root, env, rx);
      return v !== null && v !== undefined && v !== '';
    }
    case 'isEmpty': {
      const v = evaluate(e.arg, root, env, rx);
      return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    }
    case 'add':
    case 'sub':
    case 'mul': {
      const l = Number(evaluate(e.left, root, env, rx));
      const r = Number(evaluate(e.right, root, env, rx));
      if (Number.isNaN(l) || Number.isNaN(r)) return null;
      return e.op === 'add' ? l + r : e.op === 'sub' ? l - r : l * r;
    }
    case 'daysBetween': {
      const from = evaluate(e.from, root, env, rx);
      const to = evaluate(e.to, root, env, rx);
      if (typeof from !== 'string' || typeof to !== 'string') return null;
      const a = Date.parse(from + 'T00:00:00Z');
      const b = Date.parse(to + 'T00:00:00Z');
      if (Number.isNaN(a) || Number.isNaN(b)) return null;
      return Math.round((b - a) / 86_400_000);
    }
    case 'any':
    case 'all':
    case 'count':
    case 'sum':
    case 'first': {
      const over = evaluate(e.over, root, env, rx);
      const items = Array.isArray(over) ? over : [];
      let count = 0;
      let sum = 0;
      for (const item of items) {
        const inner = new Map(env);
        inner.set(e.as, item);
        const where = 'where' in e && e.where ? truthy(evaluate(e.where, root, inner, rx)) : true;
        if (e.op === 'any' && where) return true;
        if (e.op === 'all' && !where) return false;
        if (e.op === 'first' && where) return item;
        if (where) {
          count++;
          if (e.op === 'sum') sum += Number(evaluate(e.select, root, inner, rx)) || 0;
        }
      }
      if (e.op === 'any') return false;
      if (e.op === 'all') return true;
      if (e.op === 'first') return null;
      return e.op === 'count' ? count : sum;
    }
    case 'if':
      return truthy(evaluate(e.cond, root, env, rx)) ? evaluate(e.then, root, env, rx) : evaluate(e.else, root, env, rx);
  }
}

function getPath(v: JsonValue, path: string): JsonValue {
  let cur: JsonValue = v;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return null;
    if (Array.isArray(cur)) {
      const idx = Number(key);
      cur = Number.isInteger(idx) ? (cur[idx] ?? null) : null;
    } else {
      cur = Object.prototype.hasOwnProperty.call(cur, key) ? (cur[key] ?? null) : null;
    }
  }
  return cur;
}

function truthy(v: JsonValue): boolean {
  return v !== null && v !== false && v !== 0 && v !== '' && !(Array.isArray(v) && v.length === 0);
}

function looseEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b);
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b;
  return false;
}

function compare(a: JsonValue, b: JsonValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function interpolate(template: string, root: JsonValue, env: Env): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g, (_, path: string) => {
    const [head = '', ...rest] = path.split('.');
    const base = env.has(head) ? env.get(head)! : getPath(root, head);
    const v = rest.length ? getPath(base, rest.join('.')) : base;
    return v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v);
  });
}
