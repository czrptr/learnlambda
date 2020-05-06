import {
	last,
	ParseError
} from "./utils";

/* ====== Tokenization ====== */

import {
	Token as BaseToken,
	TokenizeFunction as BaseTokenizeFunction,
	tokenize as baseTokenize,
} from "./tokenize";

enum Id {
	Dot,
	Lambda,
	LeftPren,
	RightPren,
	Identifier
}

class Token implements BaseToken {
	static Id = Id;

	constructor(
		public readonly id: Id,
		public readonly start: number,
		public readonly value: string
	) {}

	toString(): string {
		if (this.id == Id.Identifier)
			return `Token{${Id[this.id]}, ${this.start}, "${this.value}"}`;
		else
			return `Token{${Id[this.id]}, ${this.start}}`;
	}
}

type TokenizeFunction = BaseTokenizeFunction<Token>;

function isSimply(id: Id): TokenizeFunction {
	return (tokens: Array<Token>, expression: string, pos: number) => {
		tokens.push(new Token(id, pos, expression));
	};
}

function isIdentifier(tokens: Array<Token>, expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Identifier) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		tokens.push(new Token(Id.Identifier, pos, expression))
	}
}

function isNotIdStart(tokens: Array<Token>, expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Identifier) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		throw new ParseError(pos, "identifier must begin with a letter");
	}
}

const rules: Array<[RegExp, TokenizeFunction]> = [
	[/^\./, isSimply(Id.Dot)],
	[/^λ/, isSimply(Id.Lambda)],
	[/^\(/, isSimply(Id.LeftPren)],
	[/^\)/, isSimply(Id.RightPren)],
	[/^[a-zA-Z][_0-9a-zA-Z']*/, isIdentifier],
	[/^[_0-9']+/, isNotIdStart]
];

function tokenize(expression: string): Array<Token> {
	return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
	Parser as BaseParser,
} from "./parse";

class Identifier {
	constructor(
		public readonly value: string,
		public deBruijn: number
	) {}

	toString(): string {
		return this.value;
	}

	toDeBruijnString(): string {
		return (this.deBruijn != 0) ? `${this.deBruijn}` : this.value;
	}
}

class Abstraction {
	constructor(
		public readonly binding: string,
		public readonly body: ASTNode
	) {}

	toString(): string {
		return `λ${this.binding}.${this.body}`;
	}

	toDeBruijnString(): string {
		return `λ ${this.body.toDeBruijnString()}`;
	}
}

class Application {
	constructor(
		public readonly left: ASTNode,
		public readonly right: ASTNode
	) {}

	toString(): string {
		const lString = this.left instanceof Abstraction ? `(${this.left})` : `${this.left}`;
		const rString = this.right instanceof Identifier ? `${this.right}` : `(${this.right})`;
		return `${lString} ${rString}`;
	}

	toDeBruijnString(): string {
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

class Parser extends BaseParser<Token> {
	private paren: number = 0;

	term(): ASTNode {
		if (this.done)
			this.raiseParseError("λ-term expected");

		if (this.skipIs(Id.Lambda)) {
			const id = this.match(Id.Identifier, "λ-abstraction binding expected", -1);
			this.match(Id.Dot, "'.' expected", -1);
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

	application(): ASTNode {
		let lhs = this.atom();

		if (!lhs)
			this.raiseParseError("λ-term expected");

		while (true) {
			const rhs = this.atom();
			if (!rhs)
				return lhs;
			else
				lhs = new Application(lhs, rhs);
		}
	}

	atom(): ASTNode | undefined {
		if (this.nextIs(Id.Dot)) {
			this.raiseParseError("'λ' expected", -1);
		} else if (this.skipIs(Id.LeftPren)) {
			this.paren += 1;
			const term = this.term();
			this.match(Id.RightPren, "')' expected");
			this.paren -= 1;
			return term;
		} else if (this.nextIs(Id.Identifier)) {
			let id = this.match(Id.Identifier, "NOT POSSIBLE");
			id = this.context.getSwap(id); // in case of double binding
			return new Identifier(id, this.context.indexOf(id));
		} else if (this.nextIs(Id.RightPren) && this.paren == 0) {
			this.raiseParseError("unmatched ')'", -1);
		} else if (this.nextIs(Id.Lambda)) {
			this.raiseParseError("'(' expected");
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
	
	return parse(tokenize(ret.toString()))
}

// (λx.x x) (λx.x x) protection by accident
// FIX ME?
function evaluate(expr: ASTNode): ASTNode {
	let eval1 = evalOnce(expr);
	let eval2 = evalOnce(eval1);
	while (!equals(eval1, eval2))
		[eval1, eval2] = [eval2, evalOnce(eval2)];
	return eval2;
}

enum StepType {
	Normal = "λ>",
	Alpha = "α>",
	Beta  = "β>",
	Als   = "≡>"
}

// TODO? error on unknown free
class ExecutionContext {

	// TODO warn
	private aliases: Map<string, ASTNode> = new Map();

	private unaliases: Map<string, string> = new Map();

	get aliasesAsStrings(): Array<[string, string]> {
		let res: Array<[string, string]> = [];
		for (const [alias, expr] of this.unaliases)
			res.push([alias, expr]);
		return res;
	}

	// TODO: treat these in the interface
	addAlias(alias: string, expr: string): void {
		let ast = parse(tokenize(expr));
		expr = ast.toString();
		ast = parse(tokenize(this.forwardAlias(ast).toString()));
		ast = parse(tokenize(evaluate(ast).toString()));

		for (let [key, value] of this.aliases)
			if (equals(ast, value))
				throw "DUPLICATE!";

		if (ast instanceof Identifier)
			throw "IDENTIFIER!";
		
		this.aliases.set(alias, ast);
		this.unaliases.set(alias, expr);
	}

	removeAlias(alias: string): boolean {
		this.aliases.delete(alias);
		return this.unaliases.delete(alias);
	}

	forAlsOnce(expr: ASTNode): ASTNode {
		let ret = expr;
		for (let [key, value] of this.aliases)
			ret = subst(ret, key, value);
		return ret;
	}

	forwardAlias(expr: ASTNode): ASTNode {
		let alias1 = this.forAlsOnce(expr);
		let alias2 = this.forAlsOnce(alias1);
		while (!equals(alias1, alias2))
			[alias1, alias2] = [alias2, this.forAlsOnce(alias2)];
		return alias2;
	}

	private bakAlsOnce(expr: ASTNode): ASTNode {
		for (let [key, value] of this.aliases)
			if (equals(expr, value))
				return new Identifier(key, 0);

		for (let [key, value] of this.aliases) {
			if (expr instanceof Application)
				return new Application(this.bakAlsOnce(expr.left), this.bakAlsOnce(expr.right));
			if (expr instanceof Abstraction)
				return new Abstraction(expr.binding, this.bakAlsOnce(expr.body));
		}

		return expr;
	}

	backwardAlias(expr: ASTNode): ASTNode {
		let alias1 = this.bakAlsOnce(expr);
		let alias2 = this.bakAlsOnce(alias1);
		while (!equals(alias1, alias2))
			[alias1, alias2] = [alias2, this.bakAlsOnce(alias2)];
		return alias2;
	}

	// print warning?
	evaluate(expression: string): ASTNode {
		let ast = parse(tokenize(expression));
		ast = parse(tokenize(this.forwardAlias(ast).toString()));
		ast = parse(tokenize(evaluate(ast).toString()));
		ast = parse(tokenize(this.backwardAlias(ast).toString()))
		return ast;
	}

	verboseEvaluate(expression: string): Array<[StepType, string]> {
		let res: Array<[StepType, string]> = [];

		let ast = parse(tokenize(expression));
		res.push([StepType.Normal, ast.toString()]);

		ast = parse(tokenize(this.forwardAlias(ast).toString()));
		res.push([StepType.Als, ast.toString()]);

		//TODO: detect renaming
		let eval1 = evalOnce(ast);
		let eval2 = evalOnce(eval1);
		while (!equals(eval1, eval2)) {
			res.push([StepType.Beta, eval1.toString()]);
			[eval1, eval2] = [eval2, evalOnce(eval2)];
		}

		ast = parse(tokenize(evaluate(ast).toString()));
		res.push([StepType.Beta, ast.toString()]);

		ast = parse(tokenize(this.backwardAlias(ast).toString()))
		res.push([StepType.Als, ast.toString()]);

		return res;
	}
}

export {
	ParseError,
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