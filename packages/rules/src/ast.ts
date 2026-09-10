/**
 * The rule expression language — `grove.rule/v1`.
 *
 * A small, JSON-serialisable AST evaluated by a safe interpreter. There is no `eval`,
 * no string-to-code path, and no way to reach outside the facts object. The language
 * is deliberately more capable than JSONLogic in one respect: it can quantify over
 * collections (`any`/`all`/`count`/`sum` over lines, with a bound variable), because
 * claim scrubbing is fundamentally about relationships between lines.
 *
 * This format is a long-lived data contract. Once customers author rules, every
 * change must ship with a migration — hence the explicit `$schema`.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type Expr =
  | { op: 'lit'; value: JsonValue }
  /** Read from facts by dotted path: "claim.placeOfService", "line.modifiers". */
  | { op: 'get'; path: string }
  /** A variable bound by a quantifier. */
  | { op: 'var'; name: string; path?: string }
  | { op: 'and'; args: Expr[] }
  | { op: 'or'; args: Expr[] }
  | { op: 'not'; arg: Expr }
  | { op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; left: Expr; right: Expr }
  /** left ∈ right, where right is a list. */
  | { op: 'in'; left: Expr; right: Expr }
  /** list `left` contains value `right`. */
  | { op: 'contains'; left: Expr; right: Expr }
  /** Regular expression test. Patterns are compiled once and length-capped. */
  | { op: 'matches'; left: Expr; pattern: string }
  | { op: 'startsWith'; left: Expr; right: Expr }
  | { op: 'len'; arg: Expr }
  | { op: 'exists'; arg: Expr }
  | { op: 'isEmpty'; arg: Expr }
  | { op: 'add' | 'sub' | 'mul'; left: Expr; right: Expr }
  /** Whole days from `from` to `to` (ISO dates). */
  | { op: 'daysBetween'; from: Expr; to: Expr }
  /** Quantifiers over a collection, binding `as` for the body. */
  | { op: 'any' | 'all'; over: Expr; as: string; where: Expr }
  | { op: 'count'; over: Expr; as: string; where?: Expr }
  | { op: 'sum'; over: Expr; as: string; select: Expr; where?: Expr }
  /** First element of a collection matching `where`, or null. */
  | { op: 'first'; over: Expr; as: string; where: Expr }
  /** if/then/else. */
  | { op: 'if'; cond: Expr; then: Expr; else: Expr };

export type Severity = 'error' | 'warning' | 'info';

export interface SuggestedFix {
  /** Machine-applicable action the UI can offer in one click. */
  action:
    | 'add_modifier'
    | 'remove_modifier'
    | 'replace_modifier'
    | 'set_place_of_service'
    | 'set_units'
    | 'remove_line'
    | 'add_diagnosis_pointer'
    | 'set_field'
    | 'obtain_abn'
    | 'run_eligibility'
    | 'request_authorization'
    | 'review';
  /** JSON pointer to the target, e.g. /lines/2/modifiers */
  target?: string;
  value?: JsonValue;
  /** Human explanation of why this fix is suggested. Always shown. */
  explanation: string;
}

export interface RuleDefinition {
  $schema: 'grove.rule/v1';
  /** `claim` evaluates once; `line` evaluates once per service line with `line` bound. */
  scope: 'claim' | 'line';
  /** Fires the finding when true. */
  when: Expr;
  /** Template with {{claim.claimNumber}}-style placeholders resolved from facts. */
  message: string;
  /** JSON pointer for the finding's location. For line scope, `{{lineIndex}}` is substituted. */
  path?: string;
  suggestedFix?: SuggestedFix;
}

export interface Finding {
  ruleKey: string;
  ruleName: string;
  severity: Severity;
  message: string;
  /** JSON pointer into the claim payload. */
  path?: string;
  lineNumber?: number;
  suggestedFix?: SuggestedFix;
  /** The facts that triggered the rule, for explainability. */
  evidence?: Record<string, JsonValue>;
  /** Where this rule came from: 'system:ncci_ptp' or 'tenant'. */
  source: string;
}

export class RuleValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'RuleValidationError';
  }
}

const MAX_DEPTH = 32;
const MAX_PATTERN_LENGTH = 200;
const KNOWN_OPS = new Set([
  'lit', 'get', 'var', 'and', 'or', 'not', 'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains',
  'matches', 'startsWith', 'len', 'exists', 'isEmpty', 'add', 'sub', 'mul', 'daysBetween',
  'any', 'all', 'count', 'sum', 'first', 'if',
]);

/**
 * Structural validation. Rejects unknown operators, excessive depth, unbound variables
 * and unsafe regular expressions BEFORE a rule can be saved, so the evaluator never
 * sees a malformed tree.
 */
export function validateRule(def: unknown): asserts def is RuleDefinition {
  if (!isObject(def)) throw new RuleValidationError('rule must be an object', '/');
  if (def['$schema'] !== 'grove.rule/v1') throw new RuleValidationError('unsupported $schema', '/$schema');
  if (def['scope'] !== 'claim' && def['scope'] !== 'line') throw new RuleValidationError('scope must be claim or line', '/scope');
  if (typeof def['message'] !== 'string' || def['message'].length === 0) throw new RuleValidationError('message is required', '/message');
  const bound = new Set<string>(def['scope'] === 'line' ? ['line'] : []);
  validateExpr(def['when'], '/when', 0, bound);
}

function validateExpr(e: unknown, path: string, depth: number, bound: Set<string>): void {
  if (depth > MAX_DEPTH) throw new RuleValidationError('expression too deep', path);
  if (!isObject(e) || typeof e['op'] !== 'string') throw new RuleValidationError('expected an expression object with op', path);
  const op = e['op'];
  if (!KNOWN_OPS.has(op)) throw new RuleValidationError(`unknown operator "${op}"`, path);
  const sub = (key: string) => validateExpr(e[key], `${path}/${key}`, depth + 1, bound);

  switch (op) {
    case 'lit':
      if (!('value' in e)) throw new RuleValidationError('lit requires value', path);
      return;
    case 'get':
      if (typeof e['path'] !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(e['path'])) {
        throw new RuleValidationError('get requires a dotted identifier path', path);
      }
      return;
    case 'var':
      if (typeof e['name'] !== 'string' || !bound.has(e['name'])) {
        throw new RuleValidationError(`unbound variable "${String(e['name'])}"`, path);
      }
      return;
    case 'and':
    case 'or': {
      if (!Array.isArray(e['args']) || e['args'].length === 0) throw new RuleValidationError(`${op} requires args`, path);
      e['args'].forEach((a, i) => validateExpr(a, `${path}/args/${i}`, depth + 1, bound));
      return;
    }
    case 'not':
    case 'len':
    case 'exists':
    case 'isEmpty':
      sub('arg');
      return;
    case 'matches':
      sub('left');
      if (typeof e['pattern'] !== 'string' || e['pattern'].length > MAX_PATTERN_LENGTH) {
        throw new RuleValidationError('matches requires a pattern under 200 chars', path);
      }
      try {
        new RegExp(e['pattern']);
      } catch {
        throw new RuleValidationError('invalid regular expression', path);
      }
      return;
    case 'daysBetween':
      sub('from');
      sub('to');
      return;
    case 'if':
      sub('cond');
      sub('then');
      sub('else');
      return;
    case 'any':
    case 'all':
    case 'count':
    case 'sum':
    case 'first': {
      sub('over');
      if (typeof e['as'] !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e['as'])) {
        throw new RuleValidationError(`${op} requires a valid binding name in "as"`, path);
      }
      const inner = new Set(bound);
      inner.add(e['as']);
      if (op === 'sum') validateExpr(e['select'], `${path}/select`, depth + 1, inner);
      if ('where' in e && e['where'] !== undefined) validateExpr(e['where'], `${path}/where`, depth + 1, inner);
      else if (op === 'any' || op === 'all' || op === 'first') throw new RuleValidationError(`${op} requires where`, path);
      return;
    }
    default:
      // Binary operators
      sub('left');
      sub('right');
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
