/* ====== Tokenization ====== */

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

export class Token implements BaseToken {
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

export function tokenize(expression: string): Array<Token> {
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
		public readonly parameter: Identifier, 
		public readonly body: ASTNode
	) {}
	
	public toString(): string {
		return `λ${this.parameter}.${this.body}`;
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
			return new Abstraction(new Identifier(id, this.context.indexOf(id)), body);
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

export function parse(tokens: Array<Token>): ASTNode {
	const parser = new Parser(tokens);
	const ast = parser.term();
	let index = parser.maxIndex;
	for (let f of parser.free)
		f.deBruijn = ++index;
	
	return ast;
}