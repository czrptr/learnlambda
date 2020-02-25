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
    static Id = Id;

    constructor(
        readonly id: Id,
        readonly start: number,
        readonly value: string
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

let rules: Array<[RegExp, TokenizeFunction]> = [
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
    readonly isSimple = true;

	constructor(
        readonly value: string
    ) {}
    
    toString(): string {
        return this.value;
    }
}

class Abstraction {
    readonly isSimple = false;

	constructor(
        readonly parameter: Identifier, 
        readonly body: Node
    ) {}
    
    toString(): string {
        return `λ${this.parameter}.${this.body}`;
    }
}

class Application {
    readonly isSimple: boolean;

    constructor(
        readonly left: Node,
        readonly right: Node
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
}

type Node = Identifier | Abstraction | Application;

/* Grammar:

term ::= LAMBDA ID DOT term
	| app

app ::= atom app
      | ε

atom ::= LEFTP term RIGHTP
	| ID

*/

export class Parser extends BaseParser<Token> {
    term(): Node {
        if (this.done) {
            throw new ParseError(this.currentPosition, "λ-term expected");
        }
        if (this.skipIs(Id.Lambda)) {
            const id = this.match(Id.Identifier, "λ-abstraction binding expected");
            this.match(Id.Dot, "'.' expected");
            const body = this.term();
            return new Abstraction(new Identifier(id), body);
        } else {
            return this.application();
        }
    }
    
    application(): Node {
        let lhs = this.atom()!;
        while (true) {
            const rhs = this.atom();
            if (rhs == null)
                return lhs;
            else
                lhs = new Application(lhs, rhs);
        }
    }
    
    atom(): Node | null {
        if (this.nextIs(Id.Dot)) {
            throw new ParseError(this.tokens[this.currentTokenIndex - 1].start, "'λ' expected");
        }
        if (this.skipIs(Id.LeftPren)) {
            const term = this.term();
            this.match(Id.RightPren, "')' expected");
            return term;
        } else if (this.nextIs(Id.Identifier)) {
            const id = this.match(Id.Identifier, "NOT POSSIBLE");
            return new Identifier(id);
        } else {
            return null;
        }
    }
}

export function parse(tokens: Array<Token>): Node {
    return new Parser(tokens).term();
}