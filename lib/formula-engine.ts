/**
 * Safe arithmetic expression evaluator.
 * Supports: numbers, +, -, *, /, (, ), decimal points.
 * Does NOT support arbitrary code execution.
 */

export interface FormulaResult {
  value: number;
  isValid: boolean;
  error?: string;
  explanation?: string;
}

// Tokenizer
type TokenType = 'NUMBER' | 'PLUS' | 'MINUS' | 'MULTIPLY' | 'DIVIDE' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  numValue?: number;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const clean = expr.trim();

  while (i < clean.length) {
    const ch = clean[i];

    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    if (ch >= '0' && ch <= '9' || ch === '.') {
      let num = '';
      while (i < clean.length && (clean[i] >= '0' && clean[i] <= '9' || clean[i] === '.')) {
        num += clean[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: num, numValue: parseFloat(num) });
      continue;
    }

    switch (ch) {
      case '+': tokens.push({ type: 'PLUS', value: '+' }); break;
      case '-': tokens.push({ type: 'MINUS', value: '-' }); break;
      case '*': tokens.push({ type: 'MULTIPLY', value: '*' }); break;
      case '/': tokens.push({ type: 'DIVIDE', value: '/' }); break;
      case '(': tokens.push({ type: 'LPAREN', value: '(' }); break;
      case ')': tokens.push({ type: 'RPAREN', value: ')' }); break;
      default:
        throw new Error(`Unexpected character: "${ch}"`);
    }
    i++;
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

// Recursive descent parser
class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  parse(): number {
    const result = this.parseExpression();
    if (this.peek().type !== 'EOF') {
      throw new Error('Unexpected token after expression');
    }
    return result;
  }

  // expression = term (('+' | '-') term)*
  private parseExpression(): number {
    let left = this.parseTerm();

    while (this.peek().type === 'PLUS' || this.peek().type === 'MINUS') {
      const op = this.consume();
      const right = this.parseTerm();
      if (op.type === 'PLUS') left += right;
      else left -= right;
    }

    return left;
  }

  // term = factor (('*' | '/') factor)*
  private parseTerm(): number {
    let left = this.parseUnary();

    while (this.peek().type === 'MULTIPLY' || this.peek().type === 'DIVIDE') {
      const op = this.consume();
      const right = this.parseUnary();
      if (op.type === 'MULTIPLY') {
        left *= right;
      } else {
        if (right === 0) throw new Error('Division by zero');
        left /= right;
      }
    }

    return left;
  }

  // unary = '-' factor | factor
  private parseUnary(): number {
    if (this.peek().type === 'MINUS') {
      this.consume();
      return -this.parsePrimary();
    }
    return this.parsePrimary();
  }

  // primary = NUMBER | '(' expression ')'
  private parsePrimary(): number {
    const token = this.peek();

    if (token.type === 'NUMBER') {
      this.consume();
      return token.numValue!;
    }

    if (token.type === 'LPAREN') {
      this.consume();
      const value = this.parseExpression();
      if (this.peek().type !== 'RPAREN') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume();
      return value;
    }

    throw new Error(`Unexpected token: "${token.value}"`);
  }
}

export function evaluateFormula(expr: string): FormulaResult {
  if (!expr || expr.trim() === '') {
    return { value: 0, isValid: false, error: 'Empty expression' };
  }

  try {
    const tokens = tokenize(expr.trim());
    const parser = new Parser(tokens);
    const value = parser.parse();

    if (!isFinite(value)) {
      return { value: 0, isValid: false, error: 'Result is not a finite number' };
    }

    return {
      value,
      isValid: true,
      explanation: buildExplanation(expr.trim(), value),
    };
  } catch (err) {
    return {
      value: 0,
      isValid: false,
      error: err instanceof Error ? err.message : 'Invalid expression',
    };
  }
}

function buildExplanation(expr: string, value: number): string {
  const clean = expr.replace(/\s+/g, ' ').trim();
  if (clean === String(value) || clean === value.toString()) {
    return `${value}`;
  }
  return `${clean} = ${round(value, 4)}`;
}

export function round(value: number, decimals = 2): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export interface ShareCalculation {
  memberId: string;
  formula: string;
  computedValue: number;
  computedShare: number;
  percentage: number;
  isValid: boolean;
  error?: string;
}

export function calculateShares(
  participants: { memberId: string; formula: string }[],
  totalAmount: number,
  splitType: string = 'proportional'
): ShareCalculation[] {
  if (participants.length === 0) return [];

  if (splitType === 'equal') {
    const share = round(totalAmount / participants.length, 2);
    return participants.map((p) => ({
      memberId: p.memberId,
      formula: p.formula,
      computedValue: 1,
      computedShare: share,
      percentage: round(100 / participants.length, 2),
      isValid: true,
    }));
  }

  // Proportional (formula-based)
  const evaluated = participants.map((p) => {
    const result = evaluateFormula(p.formula || '1');
    return {
      memberId: p.memberId,
      formula: p.formula,
      computedValue: result.isValid ? Math.max(0, result.value) : 0,
      isValid: result.isValid,
      error: result.error,
    };
  });

  const totalValue = evaluated.reduce((sum, e) => sum + e.computedValue, 0);

  return evaluated.map((e) => {
    if (totalValue === 0) {
      return {
        ...e,
        computedShare: 0,
        percentage: 0,
      };
    }
    const percentage = (e.computedValue / totalValue) * 100;
    const share = (e.computedValue / totalValue) * totalAmount;
    return {
      ...e,
      computedShare: round(share, 2),
      percentage: round(percentage, 2),
    };
  });
}

export function formatFormulaExplanation(
  formula: string,
  computedValue: number,
  totalValue: number,
  amount: number,
  currency: string
): string[] {
  const lines: string[] = [];
  const evalResult = evaluateFormula(formula);

  if (evalResult.explanation) {
    lines.push(evalResult.explanation);
  }

  if (totalValue > 0) {
    const percentage = round((computedValue / totalValue) * 100, 1);
    lines.push(
      `${round(computedValue, 2)} / ${round(totalValue, 2)} = ${percentage}%`
    );
    const share = round((computedValue / totalValue) * amount, 2);
    lines.push(`${percentage}% × ${amount} ${currency} = ${share} ${currency}`);
  }

  return lines;
}
