/* ====== Tokenization ====== */

import "./utils";

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
		throw new TokenizeError(pos, "identifier must begin with a letter");
	}
}

// TODO? add ' to identifiers
const rules: Array<[RegExp, TokenizeFunction]> = [
	[/^\./, isSimply(Id.Dot)],
	[/^λ/, isSimply(Id.Lambda)],
	[/^\(/, isSimply(Id.LeftPren)],
	[/^\)/, isSimply(Id.RightPren)],
	[/^[a-zA-Z][_0-9a-zA-Z]*/, isIdentifier],
	[/^[_0-9]+/, isNotIdStart]
];

function tokenize(expression: string): Array<Token> {
	return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
	Parser as BaseParser,
	ParseError
} from "./parse";
import { realpathSync } from "fs";

class Identifier {
	constructor(
		public readonly value: string,
		public deBruijn: number
	) {}

	public toString(): string {
		return this.value;
	}

	public toDeBruijnString(): string {
		return (this.deBruijn != 0) ? `${this.deBruijn}` : this.value;
	}
}

class Abstraction {
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
	constructor(
		public readonly left: ASTNode,
		public readonly right: ASTNode
	) {}

	public toString(): string {
		const lString = this.left instanceof Abstraction ? `(${this.left})` : `${this.left}`;
		const rString = this.right instanceof Identifier ? `${this.right}` : `(${this.right})`;
		return `${lString} ${rString}`;
	}

	public toDeBruijnString(): string {
		const lString = this.left instanceof Abstraction ? `(${this.left.toDeBruijnString()})` : `${this.left.toDeBruijnString()}`;
		const rString = this.right instanceof Identifier ? `${this.right.toDeBruijnString()}` : `(${this.right.toDeBruijnString()})`;
		return `${lString} ${rString}`;
	}
}

type ASTNode = Identifier | Abstraction | Application;

function equals(n1: ASTNode, n2: ASTNode): boolean {
	if (n1 instanceof Identifier && n2 instanceof Identifier) {
		if (n1.deBruijn == 0 && n2.deBruijn == 0)
			return n1.value == n2.value;
		return n1.deBruijn == n2.deBruijn;
	} else if (n1 instanceof Application && n2 instanceof Application) {
		return equals(n1.left, n2.left) && equals(n1.right, n2.right);
	} else if (n1 instanceof Abstraction && n2 instanceof Abstraction) {
		return equals(n1.body, n2.body);
	}
	return false;
}

/* Grammar:

term ::= LAMBDA ID DOT term
	| app

app ::= atom app
	  | ε

atom ::= LEFTP term RIGHTP
	| ID

*/

// FIXME y (λx.x)
class Parser extends BaseParser<Token> {
	public term(): ASTNode {
		if (this.done) {
			throw new ParseError(this.currentPosition, "λ-term expected");
		}
		if (this.skipIs(Id.Lambda)) {
			const id = this.match(Id.Identifier, "λ-abstraction binding expected");
			this.match(Id.Dot, "'.' expected");
			if (this.context.indexOf(id) == 0) {
				this.context.push(id);
				const body = this.term();
				this.context.pop();
				return new Abstraction(id, body);
			} else { // double binding, need fresh
				const newId = fresh(this.context.ids);
				this.context.push(newId);
				this.context.addSwap(id, newId);
				const body = this.term();
				this.context.pop();
				this.context.removeSwap(id);
				return new Abstraction(newId, body);
			}
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
			const i = this.currentTokenIndex - 1;
			throw new ParseError(this.tokens[i < 0 ? 0 : i].start, "'λ' expected");
		} else if (this.skipIs(Id.LeftPren)) {
			const term = this.term();
			this.match(Id.RightPren, "')' expected");
			return term;
		} else if (this.nextIs(Id.Identifier)) {
			let id = this.match(Id.Identifier, "NOT POSSIBLE");
			id = this.context.getSwap(id); // in case of double binding
			return new Identifier(id, this.context.indexOf(id));
		} else {
			return undefined;
		}
	}
}

function parse(tokens: Array<Token>): ASTNode {
	return new Parser(tokens).term();
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

function fresh(used: Array<string>): string {
	let i = 0;
	let f = `f${i}`;
	while (used.indexOf(f) != -1)
		f = `f${++i}`;
	return f;
}

function capSubst(expr: ASTNode, target: string, value: ASTNode): ASTNode {
	let ret: ASTNode;
	if (expr instanceof Identifier)
		ret = expr.value == target ? value : expr;
	else if (expr instanceof Application)
		ret = new Application(capSubst(expr.left, target, value), capSubst(expr.right, target, value));
	else if (expr.binding == target)
		ret = expr;
	else
		ret = new Abstraction(expr.binding, capSubst(expr.body, target, value));
	return parse(tokenize(ret.toString()));
}

function subst(expr: ASTNode, target: string, value: ASTNode): ASTNode {
	let ret: ASTNode;
	if (expr instanceof Identifier)
		ret = expr.value == target ? value : expr;
	else if (expr instanceof Application)
		ret =  new Application(subst(expr.left, target, value), subst(expr.right, target, value));
	else if (expr.binding == target)
		ret = expr;
	else if (free(value).indexOf(expr.binding) == -1) {
		ret = new Abstraction(expr.binding, subst(expr.body, target, value));
	} else {
		const f = fresh(vars(expr));
		const avoidantBody = capSubst(expr.body, expr.binding, new Identifier(f, 0));
		ret = new Abstraction(f, subst(avoidantBody, target, value));
	}
	return parse(tokenize(ret.toString()));
}

function evalOnce(expr: ASTNode): ASTNode {
	let temp: ASTNode | undefined = undefined;
	if (expr instanceof Application) {
		if (expr.left instanceof Abstraction)
			temp = subst(expr.left.body, expr.left.binding, expr.right);
		else
			temp = new Application(evalOnce(expr.left), evalOnce(expr.right));
	}
	if (expr instanceof Abstraction)
		temp = new Abstraction(expr.binding, evalOnce(expr.body));

	let ret = (temp != undefined) ? temp : expr;
	return parse(tokenize(ret.toString()));
}

function evaluate(expr: ASTNode): ASTNode {
	let eval1 = evalOnce(expr);
	let eval2 = evalOnce(eval1);
	while (!equals(eval1, eval2))
		[eval1, eval2] = [eval2, evalOnce(eval2)];
	return eval2;
}

// TODO? error on unknown free
class ExecutionContext {

	// TODO warn
	private _aliases: Map<string, ASTNode> = new Map();

	private unaliases: Map<string, string> = new Map();

	public get aliases(): Array<[string, string]> {
		let res: Array<[string, string]> = [];
		for (const [alias, expr] of this.unaliases)
			res.push([alias, expr]);
		return res;
	}

	private isCircularDefined(ast: ASTNode, defs: Array<string> = []): boolean {
		// const freeVars = free(ast);

		// let ret = false;
		// for (let freeVar of freeVars)
		// 	if (this._aliases.has(freeVar))
		// 		ret = ret && this.isCircularDefined(this._aliases.get(freeVar)!, [...defs, freeVar]);
		// return ret;
		return false;
	}

	public addAlias(alias: string, expr: string): void {
		let ast = parse(tokenize(expr));
		ast = parse(tokenize(this.forwardAlias(ast).toString()));
		ast = parse(tokenize(evaluate(ast).toString()));

		for (let [key, value] of this._aliases)
			if(equals(ast, value))
				throw "DUPLICATE!";

		if (ast instanceof Identifier)
			throw "IDENTIFIER!";
		
		this._aliases.set(alias, ast);
		//TODO: keep identifiers but remove superfluous paranthesis
		this.unaliases.set(alias, expr);
	}

	public removeAlias(alias: string): void {
		this._aliases.delete(alias);
	}

	// TODO fix collisions when substituting
	// subst all bound with fresh then alias
	private forAlsOnce(expr: ASTNode): ASTNode {
		let ret = expr;
		for (let [key, value] of this._aliases)
			ret = subst(ret, key, value);
		return ret;
	}

	private forwardAlias(expr: ASTNode): ASTNode {
		let alias1 = this.forAlsOnce(expr);
		let alias2 = this.forAlsOnce(alias1);
		while (!equals(alias1, alias2))
			[alias1, alias2] = [alias2, this.forAlsOnce(alias2)];
		return alias2;
	}

	// no identifiers (see _aliases TODO)
	// test if implementation is good
	private bakAlsOnce(expr: ASTNode): ASTNode {
		for (let [key, value] of this._aliases)
			if (equals(expr, value))
				return new Identifier(key, 0);

		for (let [key, value] of this._aliases) {
			if (expr instanceof Application)
				return new Application(this.bakAlsOnce(expr.left), this.bakAlsOnce(expr.right));
			if (expr instanceof Abstraction)
				return new Abstraction(expr.binding, this.bakAlsOnce(expr.body));
		}

		return expr;
	}

	private backwardAlias(expr: ASTNode): ASTNode {
		let alias1 = this.bakAlsOnce(expr);
		let alias2 = this.bakAlsOnce(alias1);
		while (!equals(alias1, alias2))
			[alias1, alias2] = [alias2, this.bakAlsOnce(alias2)];
		return alias2;
	}

	// TODO: don't alias bound vars
	// print warning?
	public evaluate(expression: string): ASTNode {
		let ast = parse(tokenize(expression));
		ast = parse(tokenize(this.forwardAlias(ast).toString()));
		ast = parse(tokenize(evaluate(ast).toString()));
		ast = parse(tokenize(this.backwardAlias(ast).toString()))
		return ast;
	}
}

export { TokenizeError } from './tokenize';
export { ParseError } from './parse';
export {
	Token,
	tokenize,
	parse,
	equals,
	free,
	bound,
	vars,
	capSubst,
	subst,
	evalOnce,
	evaluate,
	ExecutionContext
};