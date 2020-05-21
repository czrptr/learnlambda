import {
	last,
	ParseError,
	arrayEqual
} from "./utils";

/* ====== Tokenization ====== */

import {
	Token as BaseToken,
	TokenizeFunction as BaseTokenizeFunction,
	tokenize as baseTokenize,
} from "./tokenize";

enum Id {
	Dot,
	Colon,
	Arrow,
	Comma,
	Lambda,
	LeftPren,
	RightPren,
	// LeftSqrBr,
	// RightSqrBr,
	// Bool
	If,
	Then,
	Else,
	True,
	False,
	// Nat
	Zero,
	Succ,
	Pred,
	Plus,
	Minus,
	IsZero,
	Type,
	Variable
}

class Token implements BaseToken {
	static Id = Id;

	constructor(
		public readonly id: Id,
		public readonly start: number,
		public readonly value: string
	) {}

	toString(): string {
		if (this.id == Id.Variable || this.id == Id.Type)
			return `Token{${Id[this.id]}, ${this.start}, "${this.value}"}`;
		else
			return `Token{${Id[this.id]}, ${this.start}}`;
	}
}

type TokenizeFunction = BaseTokenizeFunction<Token>;

function isSimply(id: Id): TokenizeFunction {
	return (tokens: Token[], expression: string, pos: number) => {
		tokens.push(new Token(id, pos, expression));
	};
}

function isIdentifier(tokens: Token[], expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Variable) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		tokens.push(new Token(Id.Variable, pos, expression))
	}
}

function isNotIdStart(tokens: Token[], expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Variable) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		throw new ParseError(pos, "identifier must begin with a lowercase letter");
	}
}

const rules: [RegExp, TokenizeFunction][] = [
	[/^\./, isSimply(Id.Dot)],
	[/^:/, isSimply(Id.Colon)],
	[/^,/, isSimply(Id.Comma)],
	[/^\->/, isSimply(Id.Arrow)],
	[/^λ/, isSimply(Id.Lambda)],
	[/^\(/, isSimply(Id.LeftPren)],
	[/^\)/, isSimply(Id.RightPren)],
	// [/^\[/, isSimply(Id.LeftSqrBr)],
	// [/^\]/, isSimply(Id.RightSqrBr)],
	[/^if/, isSimply(Id.If)],
	[/^then/, isSimply(Id.Then)],
	[/^else/, isSimply(Id.Else)],
	[/^true/, isSimply(Id.True)],
	[/^false/, isSimply(Id.False)],
	[/^zero/, isSimply(Id.Zero)],
	[/^succ/, isSimply(Id.Succ)],
	[/^pred/, isSimply(Id.Pred)],
	[/^plus/, isSimply(Id.Plus)],
	[/^minus/, isSimply(Id.Minus)],
	[/^iszero/, isSimply(Id.IsZero)],
	[/^[A-Z][a-z]*/, isSimply(Id.Type)],
	[/^[a-z][_0-9a-zA-Z']*/, isIdentifier],
	[/^[_0-9']+/, isNotIdStart]
];

function tokenize(expression: string): Token[] {
	return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
	Parser as BaseParser,
} from "./parse";

class SimpleType {
	constructor(
		public readonly name: string,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.name.length;
	}

	toString(): string {
		return this.name;
	}
}

class ArrowType {
	constructor(
		public readonly input: Type,
		public readonly output: Type
	) {}

	get tokStart(): number {
		return this.input.tokStart;
	}

	get tokLength(): number {
		let inputTokLength = this.input.tokLength;
		if (!(this.input instanceof SimpleType))
			inputTokLength += 2/*()*/;
		return this.input.tokLength + 4/* -> */ + this.output.tokLength;
	}

	toString(): string {
		const input = this.input instanceof SimpleType ? `${this.input}` : `(${this.input})`; 
		return `${input} -> ${this.output}`;
	}
}

// class PairType {
// 	constructor(
// 		public readonly first: Type,
// 		public readonly second: Type,
// 	) {}

// 	toString(): string {
// 		return `[${this.first}, ${this.second}]`;
// 	}
// }

type Type = SimpleType | ArrowType; // | PairType;

function typeEqual(t1: Type, t2: Type): boolean {
	if (t1 instanceof SimpleType && t2 instanceof SimpleType)
		return t1.name == t2.name;
	if (t1 instanceof ArrowType && t2 instanceof ArrowType)
		return typeEqual(t1.input, t2.input) && typeEqual(t1.output, t2.output);
	return false;
}

class Variable {
	constructor(
		public readonly name: string,
		public readonly deBruijn: number,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.name.length;
	}

	toString(): string {
		return this.name;
	}

	toDeBruijnString(): string {
		return (this.deBruijn != 0) ? `${this.deBruijn}` : this.name;
	}
}

class Abstraction {
	constructor(
		public readonly binding: string,
		public readonly type: Type,
		public readonly body: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.binding.length + this.type.tokLength + this.body.tokLength + 3/*λ:.*/;
	}

	toString(): string {
		return `λ${this.binding}:${this.type}.${this.body}`;
	}

	toDeBruijnString(): string {
		return `λ ${this.body.toDeBruijnString()}`;
	}
}

class Application {
	constructor(
		public readonly left: AstNode,
		public readonly right: AstNode
	) {}

	get tokStart(): number {
		return this.left.tokStart;
	}

	get tokLength(): number {
		let leftTokLength = this.left.tokLength;
		if (this.left instanceof Abstraction)
			leftTokLength += 2/*()*/;

		let rightTokLength = this.right.tokLength;
		if (this.right instanceof Abstraction)
			rightTokLength += 2/*()*/;

		return leftTokLength + 1/* */ + rightTokLength; 
	}

	// TODO: IfThenElse cases
	toString(): string {
		const leftStr = this.left instanceof Abstraction ? `(${this.left})` : `${this.left}`;
		const rightStr = this.right instanceof Variable ? `${this.right}` : `(${this.right})`;
		return `${leftStr} ${rightStr}`;
	}

	toDeBruijnString(): string {
		const leftStr = this.left instanceof Abstraction ? `(${this.left.toDeBruijnString()})` : `${this.left.toDeBruijnString()}`;
		const rightStr = this.right instanceof Variable ? `${this.right.toDeBruijnString()}` : `(${this.right.toDeBruijnString()})`;
		return `${leftStr} ${rightStr}`;
	}
}

class IfThenElse {
	constructor (
		public readonly condition: AstNode,
		public readonly ifTrue: AstNode,
		public readonly ifFalse: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		function tokLength(ast: AstNode): number {
			return ast instanceof Variable ? ast.tokLength : ast.tokLength + 2/*()*/;
		};
		return tokLength(this.condition) + tokLength(this.ifTrue) + tokLength(this.ifFalse) + 15/*if  then  else */;
	}

	toString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast}` : `(${ast})`;
		};
		return `if ${toStr(this.condition)} then ${toStr(this.ifTrue)} else ${toStr(this.ifFalse)}`;
	}

	toDeBruijnString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast.toDeBruijnString()}` : `(${ast.toDeBruijnString()})`;
		};
		return `if ${toStr(this.condition)} then ${toStr(this.ifTrue)} else ${toStr(this.ifFalse)}`;
	}
}

class Succ {
	constructor (
		public readonly argument: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.argument.tokLength + 5/*succ */;
	}

	toString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument}` : `(${this.argument})`; 
		return `succ ${argStr}`;
	}

	toDeBruijnString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument.toDeBruijnString()}` : `(${this.argument.toDeBruijnString()})`; 
		return `succ ${argStr}`;
	}
}

class Pred {
	constructor (
		public readonly argument: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.argument.tokLength + 5/*pred */;
	}

	toString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument}` : `(${this.argument})`; 
		return `pred ${argStr}`;
	}

	toDeBruijnString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument.toDeBruijnString()}` : `(${this.argument.toDeBruijnString()})`; 
		return `pred ${argStr}`;
	}
}


class Plus {
	constructor (
		public readonly argument1: AstNode,
		public readonly argument2: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.argument1.tokLength + this.argument2.tokLength + 6/*plus  */;
	}

	toString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast}` : `(${ast})`;
		};
		return `plus ${toStr(this.argument1)} ${toStr(this.argument2)}`;
	}

	toDeBruijnString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast.toDeBruijnString()}` : `(${ast.toDeBruijnString()})`;
		};
		return `plus ${toStr(this.argument1)} ${toStr(this.argument2)}`;
	}
}

class Minus {
	constructor (
		public readonly argument1: AstNode,
		public readonly argument2: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.argument1.tokLength + this.argument2.tokLength + 7/*minus  */;
	}

	toString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast}` : `(${ast})`;
		};
		return `minus ${toStr(this.argument1)} ${toStr(this.argument2)}`;
	}

	toDeBruijnString(): string {
		function toStr(ast: AstNode): string {
			return ast instanceof Variable ? `${ast.toDeBruijnString()}` : `(${ast.toDeBruijnString()})`;
		};
		return `minus ${toStr(this.argument1)} ${toStr(this.argument2)}`;
	}
}

class IsZero {
	constructor (
		public readonly argument: AstNode,
		public readonly tokStart: number = -1
	) {}

	get tokLength(): number {
		return this.argument.tokLength + 7/*iszero */;
	}

	toString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument}` : `(${this.argument})`; 
		return `iszero ${argStr}`;
	}

	toDeBruijnString(): string {
		const argStr = this.argument instanceof Variable ? `${this.argument.toDeBruijnString()}` : `(${this.argument.toDeBruijnString()})`; 
		return `iszero ${argStr}`;
	}
}

type AstNode = Variable | Abstraction | Application | IfThenElse | Succ | Pred | Plus | Minus | IsZero;

function astEqual(n1: AstNode, n2: AstNode): boolean {
	if (n1 instanceof Variable && n2 instanceof Variable) {
		if (n1.deBruijn == 0 && n2.deBruijn == 0)
			return n1.name == n2.name;
		return n1.deBruijn == n2.deBruijn;
	}  else if (n1 instanceof Abstraction && n2 instanceof Abstraction) {
		return typeEqual(n1.type, n2.type) && astEqual(n1.body, n2.body);
	} else if (n1 instanceof Application && n2 instanceof Application) {
		return astEqual(n1.left, n2.left) && astEqual(n1.right, n2.right);
	} else if (n1 instanceof IfThenElse && n2 instanceof IfThenElse) {
		return astEqual(n1.condition, n2.condition) && astEqual(n1.ifTrue, n2.ifTrue) && astEqual(n1.ifFalse, n2.ifFalse);
	} else if (n1 instanceof Succ && n2 instanceof Succ) {
		return astEqual(n1.argument, n2.argument);
	} else if (n1 instanceof Pred && n2 instanceof Pred) {
		return astEqual(n1.argument, n2.argument);
	} else if (n1 instanceof Plus && n2 instanceof Plus) {
		return astEqual(n1.argument1, n2.argument1) && astEqual(n1.argument2, n2.argument2);
	} else if (n1 instanceof Minus && n2 instanceof Minus) {
		return astEqual(n1.argument1, n2.argument1) && astEqual(n1.argument2, n2.argument2);
	} else if (n1 instanceof IsZero && n2 instanceof IsZero) {
		return astEqual(n1.argument, n2.argument);
	}
	return false;
}

function vars(ast: AstNode): string[] {
	const helper = (ast: AstNode) => {
		if (ast instanceof Variable)
			return [ast.name];
		else if (ast instanceof Application)
			return [...vars(ast.left), ...vars(ast.right)];
		else if (ast instanceof IfThenElse)
			return [...vars(ast.condition), ...vars(ast.ifTrue), ...vars(ast.ifFalse)];
		else if (ast instanceof Succ)
			return vars(ast.argument);
		else if (ast instanceof Pred)
			return vars(ast.argument);
		else if (ast instanceof Plus)
			return [...vars(ast.argument1), ...vars(ast.argument2)];
		else if (ast instanceof Minus)
			return [...vars(ast.argument1), ...vars(ast.argument2)];
		else if (ast instanceof IsZero)
			return vars(ast.argument);
		else
			return [ast.binding, ...vars(ast.body)];
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function free(ast: AstNode): string[]  {
	const helper = (ast: AstNode) => {
		if (ast instanceof Variable)
			return [ast.name];
		else if (ast instanceof Application)
			return [...free(ast.left), ...free(ast.right)];
		else if (ast instanceof IfThenElse)
			return [...free(ast.condition), ...free(ast.ifTrue), ...free(ast.ifFalse)];
		else if (ast instanceof Succ)
			return free(ast.argument);
		else if (ast instanceof Pred)
			return free(ast.argument)
		else if (ast instanceof Plus)
			return [...free(ast.argument1), ...free(ast.argument2)];
		else if (ast instanceof Minus)
			return [...free(ast.argument1), ...free(ast.argument2)];
		else if (ast instanceof IsZero)
			return free(ast.argument);
		else
			return [...free(ast.body)].filter(el => el != ast.binding);
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function fresh(used: string[]): string {
	let i = 0;
	let f = `f${i}`;
	while (used.indexOf(f) != -1)
		f = `f${++i}`;
	return f;
}

/* Grammar:

term ::= LAMBDA ID COLON type DOT term
	   | app

type ::= atom_type ARROW type
	   | atom_type

atom_type ::= LEFTP type RIGHTP
			| Bool

app ::= atom app
	  | ε

atom ::= LEFTP term RIGHTP
	   | ID
	   | TRUE
	   | FALSE
	   | IF term THEN term ELSE term

*/

class Parser extends BaseParser<Token> {
	private termParen = 0;
	private typeParen = 0;

	parse(): AstNode {
		return this.term();
	}

	parseType(): Type {
		return this.type();
	}

	private isValidTypeName(typeName: string): boolean {
		return typeName == "Bool" || typeName == "Nat";
	}

	private type(): Type {
		const inputType = this.atomType();
		if (this.skipIs(Id.Arrow)) {
			const outputType = this.type();
			return new ArrowType(inputType, outputType);
		}
		return inputType;
	}

	private atomType(): Type {
		if (this.skipIs(Id.LeftPren)) {
			this.typeParen += 1;
			const type = this.type();
			this.match(Id.RightPren, "')' expected", -1);
			this.typeParen -= 1;
			return type;
		} else if (this.nextIs(Id.Type)) {
			const typeName = this.match(Id.Type);
			if (!this.isValidTypeName(typeName))
				this.raiseParseError("unknow type", -2)
			return new SimpleType(typeName, this.matchedTokenStart);
		} else if (this.nextIs(Id.RightPren) && this.typeParen == 0) {
			this.raiseParseError("unmatched ')'", -1);
		} else {
			this.raiseParseError("type expected")
		}
	}

	private term(greedy: boolean = true): AstNode {
		if (this.done)
		this.raiseParseError("unexpected end of expression");
		
		if (this.skipIs(Id.Lambda)) {
			const lambdaTokStart = this.matchedTokenStart;
			const id = this.match(Id.Variable, "λ-abstraction binding expected", -1);
			this.match(Id.Colon, "':' expected", -1);
			const type = this.type();
			this.match(Id.Dot, "'.' expected");
			if (this.context.indexOf(id) == 0) {
				this.context.push(id);
				const body = this.term();
				this.context.pop();
				return new Abstraction(id, type, body, lambdaTokStart);
			} else { // double binding, need fresh
				const newId = fresh(this.context.ids);
				this.context.push(newId);
				this.context.addSwap(id, newId);
				const body = this.term();
				this.context.pop();
				this.context.removeSwap(id);
				return new Abstraction(newId, type, body, lambdaTokStart);
			}
		} else {
			return this.application(greedy);
		}
	}

	private application(greedy: boolean = true): AstNode {
		let lhs = this.atom();

		if (!lhs)
			this.raiseParseError("λ-term expected");

		if (!greedy)
			return lhs;

		while (true) {
			const rhs = this.atom();
			if (!rhs)
				return lhs;
			else
				lhs = new Application(lhs, rhs);
		}
	}

	private atom(): AstNode | undefined {
		if (this.nextIs(Id.Dot))
			this.raiseParseError("'λ' expected");
		
		if (this.skipIs(Id.LeftPren)) {
			this.termParen += 1;
			const term = this.term();
			this.match(Id.RightPren, "')' expected");
			this.termParen -= 1;
			return term;
		} else if (this.nextIs(Id.Variable)) {
			let id = this.match(Id.Variable, "NOT POSSIBLE");
			id = this.context.getSwap(id); // in case of double binding
			return new Variable(id, this.context.indexOf(id), this.matchedTokenStart);
		} else if (this.skipIs(Id.True)) {
			return new Variable("true", 0, this.matchedTokenStart);
		} else if (this.skipIs(Id.False)) {
			return new Variable("false", 0, this.matchedTokenStart);
		} else if (this.skipIs(Id.If)) {
			const ifTokStart = this.matchedTokenStart;
			const condition = this.term();
			this.match(Id.Then, "'then' expected");
			const ifTrue = this.term();
			this.match(Id.Else, "'else' expected");
			const ifFalse = this.term();
			return new IfThenElse(condition, ifTrue, ifFalse, ifTokStart);
		} else if (this.skipIs(Id.Zero)) {
			return new Variable("zero", 0, this.matchedTokenStart);
		} else if (this.skipIs(Id.Succ)) {
			const succTokStart = this.matchedTokenStart;
			return new Succ(this.term(false), succTokStart);
		} else if (this.skipIs(Id.Pred)) {
			const predTokStart = this.matchedTokenStart;
			return new Pred(this.term(false), predTokStart);
		} else if (this.skipIs(Id.Plus)) {
			const plusTokStart = this.matchedTokenStart;
			return new Plus(this.term(false), this.term(false), plusTokStart);
		} else if (this.skipIs(Id.Minus)) {
			const minusTokStart = this.matchedTokenStart;
			return new Minus(this.term(false), this.term(false), minusTokStart);
		} else if (this.skipIs(Id.IsZero)) {
			const isZeroTokStart = this.matchedTokenStart;
			return new IsZero(this.term(false), isZeroTokStart);
		} else if (this.nextIs(Id.RightPren) && this.termParen == 0) {
			this.raiseParseError("unmatched ')'", -1);
		} else {
			return undefined;
		}
	}
}

function parse(tokens: Token[]): AstNode {
	return new Parser(tokens).parse();
}

function parseType(tokens: Token[]): Type {
	return new Parser(tokens).parseType();
}

/* ====== Typeing ====== */

type TypeContext = Map<string, Type>;

function EmptyTypeContext(): TypeContext {
	return new Map<string, Type>();
}

class TypeingError extends Error {
	constructor(
		readonly ast: AstNode,
		message?: string
	) {
		super(message);
	}

	get positionString(): string {
		const padding = " ".repeat(this.ast.tokStart);
		if (this.ast.tokLength == 1)
			return padding + "^";
		return padding + "~".repeat(this.ast.tokLength);
	}
}

// TODO keep location data (for printing errors) somehow,
// maybe keep links to tokens
function typeOf(ast: AstNode, context: TypeContext): Type {
	if (ast instanceof Variable) {
		if (ast.name == "true" || ast.name == "false")
			return new SimpleType("Bool");
		if (ast.name == "zero")
			return new SimpleType("Nat");
		const ret = context.get(ast.name);
		if (ret)
			return ret;
		throw new TypeingError(ast, `${ast.name} cannot be typed`);
	} else if (ast instanceof Abstraction) {
		// deep clone
		let newContext: TypeContext = new Map(context);
		newContext.set(ast.binding, ast.type);
		return new ArrowType(ast.type, typeOf(ast.body, newContext));
	} else if (ast instanceof Application) {
		const funcType = typeOf(ast.left, context);
		const argType = typeOf(ast.right, context);
		if (funcType instanceof ArrowType) {
			if (typeEqual(argType, funcType.input))
				return funcType.output;
			else
				throw new TypeingError(ast, "input type different than type of argument");
		} else {
			throw new TypeingError(ast, `${ast.left} in not an arrow type`);
		}
	} else if (ast instanceof IfThenElse) {
		const condType = typeOf(ast.condition, context);
		const ifTrueType = typeOf(ast.ifTrue, context);
		const ifFalseType = typeOf(ast.ifFalse, context);
		if (condType instanceof SimpleType && condType.name == "Bool") {
			if (typeEqual(ifTrueType, ifFalseType))
				return ifTrueType;
			else
				throw new TypeingError(ast, "branches are of different types");
		} else {
			throw new TypeingError(ast, "condition is not of type Bool");
		}
	} else if (ast instanceof Succ) {
		const argType = typeOf(ast.argument, context);
		if (argType instanceof SimpleType && argType.name == "Nat")
			return new SimpleType("Nat");
		throw new TypeingError(ast, "argument is not of type Nat");
	} else if (ast instanceof Pred) {
		const argType = typeOf(ast.argument, context);
		if (argType instanceof SimpleType && argType.name == "Nat")
			return new SimpleType("Nat");
		throw new TypeingError(ast, "argument is not of type Nat");
	} else if (ast instanceof Plus) {
		const arg1Type = typeOf(ast.argument1, context);
		const arg2Type = typeOf(ast.argument1, context);
		if (!(arg1Type instanceof SimpleType && arg1Type.name == "Nat"))
			throw new TypeingError(ast, "first arguments is not of type Nat");
		if (!(arg2Type instanceof SimpleType && arg2Type.name == "Nat"))
			throw new TypeingError(ast, "second arguments is not of type Nat");
		return new SimpleType("Nat");
	} else if (ast instanceof Minus) {
		const arg1Type = typeOf(ast.argument1, context);
		const arg2Type = typeOf(ast.argument1, context);
		if (!(arg1Type instanceof SimpleType && arg1Type.name == "Nat"))
			throw new TypeingError(ast, "first arguments is not of type Nat");
		if (!(arg2Type instanceof SimpleType && arg2Type.name == "Nat"))
			throw new TypeingError(ast, "second arguments is not of type Nat");
		return new SimpleType("Nat");
	} else {
		const argType = typeOf(ast.argument, context);
		if (argType instanceof SimpleType && argType.name == "Nat")
			return new SimpleType("Bool");
		throw new TypeingError(ast, "argument is not of type Nat");
	}
}

/* ====== Execution ====== */

// TODO?: target != true, false
function capSubst(expr: AstNode, target: string, value: AstNode): AstNode {
	let ret: AstNode;

	if (expr instanceof Variable)
		ret = expr.name == target ? value : expr;
	else if (expr instanceof Application)
		ret = new Application(capSubst(expr.left, target, value), capSubst(expr.right, target, value));
	else if (expr instanceof IfThenElse)
		ret = new IfThenElse(
				capSubst(expr.condition, target, value),
				capSubst(expr.ifTrue, target, value),
				capSubst(expr.ifFalse, target, value)
			);
	else if (expr instanceof Succ)
		ret = new Succ(capSubst(expr.argument, target, value));
	else if (expr instanceof Pred)
		ret = new Pred(capSubst(expr.argument, target, value));
	else if (expr instanceof Plus)
		ret = new Plus(capSubst(expr.argument1, target, value), capSubst(expr.argument2, target, value));
	else if (expr instanceof Minus)
		ret = new Minus(capSubst(expr.argument1, target, value), capSubst(expr.argument2, target, value));
	else if (expr instanceof IsZero)
		ret = new IsZero(capSubst(expr.argument, target, value));
	else if (expr.binding == target)
		ret = expr;
	else
		ret = new Abstraction(expr.binding, expr.type, capSubst(expr.body, target, value));
	
 	return parse(tokenize(ret.toString()));
}

// TODO?: target != true, false
function subst(expr: AstNode, target: string, value: AstNode): AstNode {
	let ret: AstNode;
	if (expr instanceof Variable)
		ret = expr.name == target ? value : expr;
	else if (expr instanceof Application)
		ret =  new Application(subst(expr.left, target, value), subst(expr.right, target, value));
	else if (expr instanceof IfThenElse)
		ret = new IfThenElse(
				subst(expr.condition, target, value),
				subst(expr.ifTrue, target, value),
				subst(expr.ifFalse, target, value)
			);
	else if (expr instanceof Succ)
		ret = new Succ(subst(expr.argument, target, value));
	else if (expr instanceof Pred)
		ret = new Pred(subst(expr.argument, target, value));
	else if (expr instanceof Plus)
		ret = new Plus(subst(expr.argument1, target, value), subst(expr.argument2, target, value));
	else if (expr instanceof Minus)
		ret = new Minus(subst(expr.argument1, target, value), subst(expr.argument2, target, value));
	else if (expr instanceof IsZero)
		ret = new IsZero(subst(expr.argument, target, value));
	else if (expr.binding == target)
		ret = expr;
	else if (free(value).indexOf(expr.binding) == -1) {
		ret = new Abstraction(expr.binding, expr.type, subst(expr.body, target, value));
	} else {
		const f = fresh(vars(expr));
		const avoidantBody = capSubst(expr.body, expr.binding, new Variable(f, 0));
		ret = new Abstraction(f, expr.type, subst(avoidantBody, target, value));
	}

	return parse(tokenize(ret.toString()));
}

function evalOnce(ast: AstNode): AstNode {
	let temp: AstNode | undefined = undefined;

	if (ast instanceof Application) {
		if (ast.left instanceof Abstraction)
			temp = subst(ast.left.body, ast.left.binding, ast.right);
		else
			temp = new Application(evalOnce(ast.left), evalOnce(ast.right));
	} else if (ast instanceof Abstraction) {
		temp = new Abstraction(ast.binding, ast.type, evalOnce(ast.body));
	} else if (ast instanceof IfThenElse) {
		const cond = ast.condition;
		if (cond instanceof Variable) {
			if (cond.name == "true")
				temp = ast.ifTrue;
			else if (cond.name == "false")
				temp = ast.ifFalse
		} else {
			temp = new IfThenElse(evalOnce(ast.condition), ast.ifTrue, ast.ifFalse);
		}
	} else if (ast instanceof Succ) {
		temp = new Succ(evalOnce(ast.argument));
	} else if (ast instanceof Pred) {
		if (ast.argument instanceof Succ)
			temp = ast.argument.argument;
		else if (ast.argument instanceof Variable && ast.argument.name == "zero")
			throw "(pred zero) is undefined";
		else 
			temp = new Pred(evalOnce(ast.argument));
	} else if (ast instanceof Plus) {
		if (ast.argument2 instanceof Succ) {
			temp = ast;
			let arg2 = temp.argument2;
			while (arg2 instanceof Succ) {
				temp = new Plus(new Succ(temp.argument1), arg2.argument);
				arg2 = arg2.argument;
			}
			temp = temp.argument1;
		} else if (ast.argument2 instanceof Variable && ast.argument2.name == "zero") {
			temp = ast.argument1;
		} else {
			temp = new Plus(evalOnce(ast.argument1), evalOnce(ast.argument2));
		}
	} else if (ast instanceof Minus) {
		if (ast.argument2 instanceof Succ) {
			temp = ast;
			let arg2 = temp.argument2;
			while (arg2 instanceof Succ) {
				temp = new Minus(new Pred(temp.argument1), arg2.argument);
				arg2 = arg2.argument;
			}
			temp = temp.argument1;
		} else if (ast.argument2 instanceof Variable && ast.argument2.name == "zero") {
			temp = ast.argument1;
		} else {
			temp = new Minus(evalOnce(ast.argument1), evalOnce(ast.argument2));
		}
	} else if (ast instanceof IsZero) {
		if (ast.argument instanceof Succ)
			temp = new Variable("false", 0);
		else if (ast.argument instanceof Variable && ast.argument.name == "zero")
			temp = new Variable("true", 0);
		else
			temp = new IsZero(evalOnce(ast.argument));
	}

	let ret = (temp != undefined) ? temp : ast;
	
	return parse(tokenize(ret.toString()))
}

class ExecutionContext {
	private _aliases: Map<string, AstNode> = new Map();
	private unaliases: Map<string, [string, string]> = new Map();
	private typeContext = EmptyTypeContext();

	get aliasesAsStrings(): Array<[string, string]> {
		let res: Array<[string, string]> = [];
		for (const [alias, expr] of this.unaliases)
			res.push([alias, expr[0]]);
		return res;
	}

	get aliases(): [string, string, string][] {
		let res: [string, string, string][] = [];
		for (const [alias, [expr, exprType]] of this.unaliases)
			res.push([alias, expr, exprType]);
		return res;
	}

	addAlias(alias: string, expr: string): void {
		const exprType = typeOf(parse(tokenize(expr)), this.typeContext);
		this.typeContext.set(alias, exprType);
		let ast = this.evaluate(expr);

		for (let [key, value] of this._aliases)
			if (astEqual(ast, value))
				throw "DUPLICATE!";

		// TODO: expect true, false?
		// or special error messages
		if (ast instanceof Variable)
			throw "VARIABLE!";
		
		this._aliases.set(alias, ast);
		this.unaliases.set(alias, [expr, exprType.toString()]);
	}

	addAliasWithType(alias: string, type: string, expr: string) {
		let typeContext = new Map(this.typeContext);
		typeContext.set(alias, parseType(tokenize(type)));
		
		const exprType = typeOf(parse(tokenize(expr)), typeContext);
		this.typeContext = typeContext;
		let ast = this.evaluate(expr);

		for (let [key, value] of this._aliases)
			if (astEqual(ast, value))
				throw "DUPLICATE!";

		// TODO: expect true, false?
		// or special error messages
		if (ast instanceof Variable)
			throw "VARIABLE!";
		
		this._aliases.set(alias, ast);
		this.unaliases.set(alias, [expr, exprType.toString()]);
	}

	removeAlias(alias: string): boolean {
		this._aliases.delete(alias);
		return this.unaliases.delete(alias);
	}

	forAlsOnce(expr: AstNode): AstNode {
		let ret = expr;
		for (let [key, value] of this._aliases)
			ret = subst(ret, key, value);
		return ret;
	}

	forwardAlias(expr: AstNode): AstNode {
		let alias1 = this.forAlsOnce(expr);
		let alias2 = this.forAlsOnce(alias1);
		while (!astEqual(alias1, alias2))
			[alias1, alias2] = [alias2, this.forAlsOnce(alias2)];
		return alias2;
	}

	private bakAlsOnce(expr: AstNode): AstNode {
		for (let [key, value] of this._aliases)
			if (astEqual(expr, value))
				return new Variable(key, 0);

		if (expr instanceof Application)
			return new Application(this.bakAlsOnce(expr.left), this.bakAlsOnce(expr.right));

		if (expr instanceof Abstraction)
			return new Abstraction(expr.binding, expr.type, this.bakAlsOnce(expr.body));

		if (expr instanceof IfThenElse)
			return new IfThenElse(
				this.bakAlsOnce(expr.condition),
				this.bakAlsOnce(expr.ifTrue),
				this.bakAlsOnce(expr.ifFalse)
			);

		return expr;
	}

	backwardAlias(expr: AstNode): AstNode {
		let alias1 = this.bakAlsOnce(expr);
		let alias2 = this.bakAlsOnce(alias1);
		while (!astEqual(alias1, alias2))
			[alias1, alias2] = [alias2, this.bakAlsOnce(alias2)];
		return alias2;
	}

	evaluate(expr: string): AstNode {
		let ast1 = parse(tokenize(expr));

		const _ = typeOf(ast1, this.typeContext);

		ast1 = parse(tokenize(this.forAlsOnce(ast1).toString()));

		ast1 = evalOnce(ast1);
		let ast2 = evalOnce(ast1);
		while (!astEqual(ast1, ast2)) {
			while (!astEqual(ast1, ast2)) {
				[ast1, ast2] = [ast2, evalOnce(ast2)];
			}
			[ast1, ast2] = [ast2, parse(tokenize(this.forAlsOnce(ast2).toString()))];
		}
		ast2 = parse(tokenize(this.backwardAlias(ast2).toString()));
		return ast2;
	}

	// verboseEvaluate(expr: string): [string, string][] {
	// 	let result: [string, string][] = [];

	// 	let ast1 = parse(tokenize(expr));
	// 	result.push(["λ>", `${ast1}`]);

	// 	ast1 = parse(tokenize(this.forwardAlias(ast1).toString()));
	// 	result.push(["≡>", `${ast1}`]);

	// 	// let ast2 = evalOnce(ast1);
	// 	// while (!astEqual(ast1, ast2)) {
	// 	// 	result.push(["β>", `${ast2}`]);
	// 	// 	[ast1, ast2] = [ast2, evalOnce(ast2)];
	// 	// }

	// 	let ast2 = evalOnce(ast1);
	// 	while (!astEqual(ast1, ast2)) {
	// 		while (!astEqual(ast1, ast2)) {
	// 			result.push(["β>", `${ast2}`]);
	// 			[ast1, ast2] = [ast2, evalOnce(ast2)];
	// 		}
	// 		[ast1, ast2] = [ast2, parse(tokenize(this.forAlsOnce(ast2).toString()))];
	// 	}

	// 	ast2 = parse(tokenize(this.backwardAlias(ast2).toString()));
	// 	result.push(["≡>" ,`${ast2}`]);

	// 	return result;
	// }
}

export {
	AstNode, Type, EmptyTypeContext, evalOnce, ExecutionContext,
	ParseError,
	TypeingError,
	tokenize,
	parse,
	astEqual,
	subst,
	typeOf,
}