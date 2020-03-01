/* ====== Tokenization ====== */

import "./utils/array";

import {
	Token as BaseToken,
	TokenizeFunction as BaseTokenizeFunction,
	tokenize as baseTokenize,
	TokenizeError
} from "./tokenize";

enum Id {
	Dot,
	Lambda,
	LeftPren,
	RightPren,
	Identifier
}

class Token implements BaseToken {
	public static Id = Id;

	constructor(
		public readonly id: Id,
		public readonly start: number,
		public readonly value: string
	) {}

	public toString(): string {
		if (this.id == Id.Identifier)
			return `Token{${Id[this.id]}, ${this.start}, "${this.value}"}`;
		else
			return `Token{${Id[this.id]}, ${this.start}}`;
	}
}

type TokenizeFunction = BaseTokenizeFunction<Token>;

function isSimply(id: Id): TokenizeFunction {
	let result: TokenizeFunction = (tokens: Array<Token>, expression: string, pos: number) => {
		tokens.push(new Token(id, pos, expression));
	};
	return result;
}

function isIdentifier(tokens: Array<Token>, expression: string, pos: number): void {
	if (tokens.last() && tokens.last()!.id == Id.Identifier) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		tokens.push(new Token(Id.Identifier, pos, expression))
	}
}

function isNotIdStart(tokens: Array<Token>, expression: string, pos: number): void {
	if (tokens.last() && tokens.last()!.id == Id.Identifier) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		throw new TokenizeError(pos, "identifier must begin with a lowercase letter");
	}
}

const rules: Array<[RegExp, TokenizeFunction]> = [
	[/^\./, isSimply(Id.Dot)],
	[/^λ/, isSimply(Id.Lambda)],
	[/^\(/, isSimply(Id.LeftPren)],
	[/^\)/, isSimply(Id.RightPren)],
	[/^[a-z][_0-9a-zA-Z]*/, isIdentifier],
	[/^[_0-9A-Z]+/, isNotIdStart]
];

function tokenize(expression: string): Array<Token> {
	return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
	Parser as BaseParser,
	ParseError
} from "./parse";

class Identifier {
	public readonly isSimple: boolean = true;

	constructor(
		public readonly value: string,
		public deBruijn: number
	) {}

	public toString(): string {
		return this.value;
	}

	public toDeBruijnString(): string {
		return `${this.deBruijn}`;
	}
}

class Abstraction {
	public readonly isSimple: boolean = false;

	constructor(
		public readonly binding: string,
		public readonly body: ASTNode
	) {}

	public toString(): string {
		return `λ${this.binding}.${this.body}`;
	}

	public toDeBruijnString(): string {
		return `λ ${this.body.toDeBruijnString()}`;
	}
}

class Application {
	public readonly isSimple: boolean;

	constructor(
		public readonly left: ASTNode,
		public readonly right: ASTNode
	) {
		this.isSimple = left.isSimple && right instanceof Identifier;
	}

	toString(): string {
		if (this.isSimple) {
			return `${this.left} ${this.right}`;
		} else if (this.left.isSimple) {
			return `${this.left} (${this.right})`;
		} else if (this.right.isSimple) {
			return `(${this.left}) ${this.right}`;
		} else {
			return `(${this.left}) (${this.right})`;
		}
	}

	toDeBruijnString(): string {
		if (this.isSimple) {
			return `${this.left.toDeBruijnString()} ${this.right.toDeBruijnString()}`;
		} else if (this.left.isSimple) {
			return `${this.left.toDeBruijnString()} (${this.right.toDeBruijnString()})`;
		} else if (this.right.isSimple) {
			return `(${this.left.toDeBruijnString()}) ${this.right.toDeBruijnString()}`;
		} else {
			return `(${this.left.toDeBruijnString()}) (${this.right.toDeBruijnString()})`;
		}
	}
}

type ASTNode = Identifier | Abstraction | Application;

/* Grammar:

term ::= LAMBDA ID DOT term
	| app

app ::= atom app
	  | ε

atom ::= LEFTP term RIGHTP
	| ID

*/

class Parser extends BaseParser<Token> {
	public free: Array<Identifier> = [];

	public term(): ASTNode {
		if (this.done) {
			throw new ParseError(this.currentPosition, "λ-term expected");
		}
		if (this.skipIs(Id.Lambda)) {
			const id = this.match(Id.Identifier, "λ-abstraction binding expected");
			this.context.push(id);
			this.match(Id.Dot, "'.' expected");
			const body = this.term();
			this.context.pop();
			return new Abstraction(id, body);
		} else {
			return this.application();
		}
	}

	public application(): ASTNode {
		let lhs = this.atom()!;
		while (true) {
			const rhs = this.atom();
			if (!rhs)
				return lhs;
			else
				lhs = new Application(lhs, rhs);
		}
	}

	public atom(): ASTNode | undefined {
		if (this.nextIs(Id.Dot)) {
			throw new ParseError(this.tokens[this.currentTokenIndex - 1].start, "'λ' expected");
		}
		if (this.skipIs(Id.LeftPren)) {
			const term = this.term();
			this.context.pop();
			this.match(Id.RightPren, "')' expected");
			return term;
		} else if (this.nextIs(Id.Identifier)) {
			const id = this.match(Id.Identifier, "NOT POSSIBLE");
			var identifier = new Identifier(id, this.context.indexOf(id));
			if (identifier.deBruijn == 0)
				this.free.push(identifier);
			return identifier;
		} else {
			return undefined;
		}
	}
}

function parse(tokens: Array<Token>): ASTNode {
	const parser = new Parser(tokens);
	const ast = parser.term();

	let index = parser.maxIndex;
	let dict: Map<string, number> = new Map();
	for (let free of parser.free) {
		let result = dict.get(free.value);
		dict.set(free.value, result ? result : ++index);
	}

	for (let free of parser.free)
		free.deBruijn = dict.get(free.value)!;

	return ast;
}

function equals(n1: ASTNode, n2: ASTNode): boolean {
	return n1.toDeBruijnString() == n2.toDeBruijnString();
}

function bound(ast: ASTNode): Array<string>  {
	const helper = (ast: ASTNode) => {
		if (ast instanceof Identifier)
			return [];
		else if (ast instanceof Application)
			return [...bound(ast.left), ...bound(ast.right)];
		else
			return [ast.binding, ...bound(ast.body)];
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function free(ast: ASTNode): Array<string>  {
	const helper = (ast: ASTNode) => {
		if (ast instanceof Identifier)
			return [ast.value];
		else if (ast instanceof Application)
			return [...free(ast.left), ...free(ast.right)];
		else
			return [...free(ast.body)].filter(el => el != ast.binding);
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function vars(ast: ASTNode): Array<string> {
	const helper = (ast: ASTNode) => {
		if (ast instanceof Identifier)
			return [ast.value];
		else if (ast instanceof Application)
			return [...vars(ast.left), ...vars(ast.right)];
		else
			return [ast.binding, ...vars(ast.body)];
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function fresh(ast: ASTNode): string {
	const used = vars(ast);
	let i = 0;
	let f = `f${i}`;
	while (used.indexOf(f) != -1)
		f = `f${++i}`;
	return f;
}

function capSubst(expr: ASTNode, target: string, value: ASTNode): ASTNode {
	if (expr instanceof Identifier)
		return expr.value == target ? value : expr;
	else if (expr instanceof Application)
		return new Application(capSubst(expr.left, target, value), capSubst(expr.right, target, value));
	else if (expr.binding == target)
		return expr;
	else
		return new Abstraction(expr.binding, capSubst(expr.body, target, value));
}

function subst(expr: ASTNode, target: string, value: ASTNode): ASTNode {
	if (expr instanceof Identifier)
		return expr.value == target ? value : expr;
	else if (expr instanceof Application)
		return new Application(capSubst(expr.left, target, value), capSubst(expr.right, target, value));
	else if (expr.binding == target)
		return expr;
	else if (free(value).indexOf(expr.binding) == -1) {
		return new Abstraction(expr.binding, subst(expr.body, target, value));
	} else {
		const f = fresh(expr);
		const avoidantBody = capSubst(expr.body, expr.binding, new Identifier(f, 0));
		return new Abstraction(f, subst(avoidantBody, target, value));
	}
}

// TODO: make more efficient
function substitute(expr: ASTNode, target: string, value: ASTNode): ASTNode {
	return parse(tokenize(subst(expr, target, value).toString()));
}

function evalOnce(expr: ASTNode): ASTNode {
	if (expr instanceof Application) {
		if (expr.left instanceof Abstraction)
			return substitute(expr.left.body, expr.left.binding, expr.right);
		else
			return new Application(evalOnce(expr.left), evalOnce(expr.right));
	}
	return expr;
}

function evaluate(expr: ASTNode): ASTNode {
	let eval1 = evalOnce(expr);
	let eval2 = evalOnce(eval1);
	while (!equals(eval1, eval2))
		[eval1, eval2] = [eval2, evalOnce(eval2)];
	return eval2;
}

class ExecutionContext {
	public aliases: Map<string, ASTNode>;

	constructor() {
		this.aliases = new Map();
	}

	public forwardAlias(ast: ASTNode): ASTNode {
		let ret = ast;
		this.aliases.forEach((value, key) => {
			ret = substitute(ret, key, value);
		});
		return ret;
	}

	//TODO backwardAlias

	public evaluate(expression: string): ASTNode {
		return evaluate(this.forwardAlias(parse(tokenize(expression))));
	}
}

export { TokenizeError } from './tokenize';
export { ParseError } from './parse';
export {
	ExecutionContext
};