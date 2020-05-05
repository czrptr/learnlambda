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
	Colon,
	Arrow,
	Comma,
	Lambda,
	LeftPren,
	RightPren,
	// LeftSqrBr,
	// RightSqrBr,
	If,
	Then,
	Else,
	True,
	False,
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
	return (tokens: Array<Token>, expression: string, pos: number) => {
		tokens.push(new Token(id, pos, expression));
	};
}

function isIdentifier(tokens: Array<Token>, expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Variable) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		tokens.push(new Token(Id.Variable, pos, expression))
	}
}

function isNotIdStart(tokens: Array<Token>, expression: string, pos: number): void {
	if (last(tokens) && last(tokens)!.id == Id.Variable) {
		const last = (tokens.pop())!;
		tokens.push(new Token(last.id, last.start, last.value + expression))
	} else {
		throw new ParseError(pos, "identifier must begin with a lowercase letter");
	}
}

const rules: Array<[RegExp, TokenizeFunction]> = [
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
	[/^[A-Z][a-z]*/, isSimply(Id.Type)],
	[/^[a-z][_0-9a-zA-Z']*/, isIdentifier],
	[/^[_0-9']+/, isNotIdStart]
];

function tokenize(expression: string): Array<Token> {
	return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
	Parser as BaseParser,
} from "./parse";

class SimpleType {
	constructor(
		public readonly value: string,
	) {}

	toString(): string {
		return this.value;
	}
}

class ArrowType {
	constructor(
		public readonly input: Type,
		public readonly output: Type,
	) {}

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

function typeEquals(t1: Type, t2: Type): boolean {
	if (t1 instanceof SimpleType && t2 instanceof SimpleType)
		return t1.value == t2.value;
	if (t1 instanceof ArrowType && t2 instanceof ArrowType)
		return typeEquals(t1.input, t2.input) && typeEquals(t1.output, t2.output);
	return false;
}

class Variable {
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
		public readonly type: Type,
		public readonly body: AstNode
	) {}

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

	toString(): string {
		const lString = this.left instanceof Abstraction ? `(${this.left})` : `${this.left}`;
		const rString = this.right instanceof Variable ? `${this.right}` : `(${this.right})`;
		return `${lString} ${rString}`;
	}

	toDeBruijnString(): string {
		const lString = this.left instanceof Abstraction ? `(${this.left.toDeBruijnString()})` : `${this.left.toDeBruijnString()}`;
		const rString = this.right instanceof Variable ? `${this.right.toDeBruijnString()}` : `(${this.right.toDeBruijnString()})`;
		return `${lString} ${rString}`;
	}
}

class IfThenElse {
	constructor (
		public readonly condition: AstNode,
		public readonly ifTrue: AstNode,
		public readonly ifFalse: AstNode
	) {}

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

type AstNode = Variable | Abstraction | Application | IfThenElse;

function astEquals(n1: AstNode, n2: AstNode): boolean {
	if (n1 instanceof Variable && n2 instanceof Variable) {
		if (n1.deBruijn == 0 && n2.deBruijn == 0)
			return n1.value == n2.value;
		return n1.deBruijn == n2.deBruijn;
	}  else if (n1 instanceof Abstraction && n2 instanceof Abstraction) {
		return typeEquals(n1.type, n2.type) && astEquals(n1.body, n2.body);
	} else if (n1 instanceof Application && n2 instanceof Application) {
		return astEquals(n1.left, n2.left) && astEquals(n1.right, n2.right);
	} else if (n1 instanceof IfThenElse && n2 instanceof IfThenElse) {
		return astEquals(n1.condition, n2.condition) && astEquals(n1.ifTrue, n2.ifTrue) && astEquals(n1.ifFalse, n2.ifFalse);
	}
	return false;
}

function vars(ast: AstNode): Array<string> {
	const helper = (ast: AstNode) => {
		if (ast instanceof Variable)
			return [ast.value];
		else if (ast instanceof Application)
			return [...vars(ast.left), ...vars(ast.right)];
		else if (ast instanceof IfThenElse)
			return [...vars(ast.condition), ...vars(ast.ifTrue), ...vars(ast.ifFalse)];
		else
			return [ast.binding, ...vars(ast.body)];
	};

	const ret = helper(ast);
	return ret.filter((v, i) => ret.indexOf(v) == i);
}

function free(ast: AstNode): Array<string>  {
	const helper = (ast: AstNode) => {
		if (ast instanceof Variable)
			return [ast.value];
		else if (ast instanceof Application)
			return [...free(ast.left), ...free(ast.right)];
		else if (ast instanceof IfThenElse)
			return [...free(ast.condition), ...free(ast.ifTrue), ...free(ast.ifFalse)];
		else
			return [...free(ast.body)].filter(el => el != ast.binding);
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

// TODO: target != true,false
function capSubst(expr: AstNode, target: string, value: AstNode): AstNode {
	let ret: AstNode;

	if (expr instanceof Variable)
		ret = expr.value == target ? value : expr;
	else if (expr instanceof Application)
		ret = new Application(capSubst(expr.left, target, value), capSubst(expr.right, target, value));
	else if (expr instanceof IfThenElse)
		ret = new IfThenElse(
				capSubst(expr.condition, target, value),
				capSubst(expr.ifTrue, target, value),
				capSubst(expr.ifFalse, target, value)
			);
	else if (expr.binding == target)
		ret = expr;
	else
		ret = new Abstraction(expr.binding, expr.type, capSubst(expr.body, target, value));
	
	return parse(tokenize(ret.toString()));
}

// TODO: target != true,false
function subst(expr: AstNode, target: string, value: AstNode): AstNode {
	let ret: AstNode;
	if (expr instanceof Variable)
		ret = expr.value == target ? value : expr;
	else if (expr instanceof Application)
		ret =  new Application(subst(expr.left, target, value), subst(expr.right, target, value));
	else if (expr instanceof IfThenElse)
		ret = new IfThenElse(
				subst(expr.condition, target, value),
				subst(expr.ifTrue, target, value),
				subst(expr.ifFalse, target, value)
			);
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

function isValidTypeName(typeName: string): boolean {
	return typeName == "Bool";
}

class Parser extends BaseParser<Token> {
	private termParen = 0;
	private typeParen = 0;

	type(): Type {
		const inputType = this.atomType();
		if (this.skipIs(Id.Arrow)) {
			const outputType = this.type();
			return new ArrowType(inputType, outputType);
		}
		return inputType;
	}

	atomType(): Type {
		if (this.skipIs(Id.LeftPren)) {
			this.typeParen += 1;
			const type = this.type();
			this.match(Id.RightPren, "')' expected", -1);
			this.typeParen -= 1;
			return type;
		} else if (this.nextIs(Id.Type)) {
			const typeName = this.match(Id.Type);
			if (!isValidTypeName(typeName))
				this.raiseParseError("unknow type", -2)
			return new SimpleType(typeName);
		} else if (this.nextIs(Id.RightPren) && this.typeParen == 0) {
			this.raiseParseError("unmatched ')'", -1);
		} else {
			this.raiseParseError("type expected")
		}
	}

	term(): AstNode {
		if (this.done)
		this.raiseParseError("unexpected end of expression");
		
		if (this.skipIs(Id.Lambda)) {
			const id = this.match(Id.Variable, "λ-abstraction binding expected", -1);
			this.match(Id.Colon, "':' expected", -1);
			const type = this.type();
			this.match(Id.Dot, "'.' expected");
			if (this.context.indexOf(id) == 0) {
				this.context.push(id);
				const body = this.term();
				this.context.pop();
				return new Abstraction(id, type, body);
			} else { // double binding, need fresh
				const newId = fresh(this.context.ids);
				this.context.push(newId);
				this.context.addSwap(id, newId);
				const body = this.term();
				this.context.pop();
				this.context.removeSwap(id);
				return new Abstraction(newId, type, body);
			}
		} else {
			return this.application();
		}
	}

	application(): AstNode {
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

	atom(): AstNode | undefined {
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
			return new Variable(id, this.context.indexOf(id));
		} else if (this.skipIs(Id.True)) {
			return new Variable("true", 0);
		} else if (this.skipIs(Id.False)) {
			return new Variable("false", 0);
		} else if (this.skipIs(Id.If)) {
			const condition = this.term();
			this.match(Id.Then, "'then' expected");
			const ifTrue = this.term();
			this.match(Id.Else, "'else' expected");
			const ifFalse = this.term();
			return new IfThenElse(condition, ifTrue, ifFalse);
		} else if (this.nextIs(Id.RightPren) && this.termParen == 0) {
			this.raiseParseError("unmatched ')'", -1);
		} else {
			return undefined;
		}
	}
}

function parse(tokens: Array<Token>): AstNode {
	return new Parser(tokens).term();
}

/* ====== Typeing ====== */

type TypeContext = Map<string, Type>;

function EmptyTypeContext(): TypeContext {
	return new Map<string, Type>();
}

class TypeingError extends Error {
	constructor(message?: string) {
		super(message);
	}
}

// TODO keep location data (for printing errors) somehow,
// maybe keep links to tokens
function typeOf(ast: AstNode, context: TypeContext): Type {
	if (ast instanceof Variable) {
		if (ast.value == "true" || ast.value == "false")
			return new SimpleType("Bool");
		
		const ret = context.get(ast.value);
		if (ret)
			return ret;
		throw new TypeingError(`${ast.value} cannot be typed`);
	} else if (ast instanceof Abstraction) {
		// deep clone
		let newContext: TypeContext = new Map(context);
		newContext.set(ast.binding, ast.type);
		return new ArrowType(ast.type, typeOf(ast.body, newContext));
	} else if (ast instanceof Application) {
		const funcType = typeOf(ast.left, context);
		const argType = typeOf(ast.right, context);
		if (funcType instanceof ArrowType) {
			if (typeEquals(argType, funcType.input))
				return argType;
			else
				throw new TypeingError(`in ${ast}: ${ast.left} input type different than type of ${ast.right}`);
		} else {
			throw new TypeingError(`in ${ast}: ${ast.left} in not an arrow type`);
		}

	} else {
		const condType = typeOf(ast.condition, context);
		const ifTrueType = typeOf(ast.ifTrue, context);
		const ifFalseType = typeOf(ast.ifFalse, context);
		if (condType instanceof SimpleType && condType.value == "Bool") {
			if (typeEquals(ifTrueType, ifFalseType))
				return ifTrueType;
			else
				throw new TypeingError(`in ${ast}: branches ar of different types`);
		} else {
			throw new TypeingError(`in ${ast}: condition is not of type Bool`);
		}
	}
}

class ExecutionContext {

}

export {
	AstNode, Type, EmptyTypeContext,
	ParseError,
	TypeingError,
	tokenize,
	parse,
	astEquals,
	subst,
	typeOf,
}