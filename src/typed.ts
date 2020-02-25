/* ====== Tokenization ====== */

import {
    Token as BaseToken,
    TokenizeFunction as BaseTokenizeFunction,
    tokenize as baseTokenize,
    TokenizeError
} from "./tokenize";

enum Id {
    Dot,
    Colon,
    Arrow,
    Comma,
    Lambda,
    LeftPren,
    RightPren,
    LeftSqrBr,
    RightSqrBr,
    True,
    False,
    Zero,
    Type,
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
        if (this.id == Id.Identifier || this.id == Id.Type)
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
    [/^:/, isSimply(Id.Colon)],
    [/^,/, isSimply(Id.Comma)],
    [/^\->/, isSimply(Id.Arrow)],
    [/^λ/, isSimply(Id.Lambda)],
    [/^\(/, isSimply(Id.LeftPren)],
    [/^\)/, isSimply(Id.RightPren)],
    [/^\[/, isSimply(Id.LeftSqrBr)],
    [/^\]/, isSimply(Id.RightSqrBr)],
    [/^true/, isSimply(Id.True)],
    [/^false/, isSimply(Id.False)],
    [/^zero/, isSimply(Id.Zero)],
    [/^[A-Z][a-z]*/, isSimply(Id.Type)],
    [/^[a-z][_0-9a-zA-Z]*/, isIdentifier],
    [/^[_0-9]+/, isNotIdStart]
];

export function tokenize(expression: string): Array<Token> {
    return baseTokenize(expression, rules);
}

/* ====== Parsing ====== */

import {
    Parser as BaseParser,
    ParseError
} from "./parse";

class SimpleType {
    readonly isSimple = true;

    constructor(
        readonly value: string,
    ) {}

    toString(): string {
        return this.value;
    }
}

class ArrowType {
    readonly isSimple: boolean;

    constructor(
        readonly input: Type,
        readonly output: Type,
    ) {
        this.isSimple = input.isSimple;
    }

    toString(): string {
        // return `(${this.input} -> ${this.output})`;

        const input = this.input instanceof SimpleType ? `${this.input}` : `(${this.input})`; 
        const output = this.output.isSimple ? `${this.output}` : `(${this.output})`;
        return `${input} -> ${output}`;
    }
}

class PairType {
    readonly isSimple = true;

    constructor(
        readonly first: Type,
        readonly second: Type,
    ) {}

    toString(): string {
        return `[${this.first}, ${this.second}]`;
    }
}

type Type = SimpleType | ArrowType | PairType;

function isValidTypeName(typeName: string): boolean {
    return typeName == "Bool" || typeName == "Nat";
}

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
        readonly type: Type,
        readonly body: Node
    ) {}
    
    toString(): string {
        return `λ${this.parameter}:${this.type}.${this.body}`;
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
        // return `(${this.left} ${this.right})`

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

term ::= LAMBDA ID COLON type DOT term
	| app

type ::= atom_type ARROW type
       | atom_type

atom_type ::= LEFTP type RIGHTP
            | LEFTSB type COMMA type RIGHTSB
            | ID

app ::= atom app
      | ε

atom ::= LEFTP term RIGHTP
	| ID

*/

export class Parser extends BaseParser<Token> {
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
            const type = this.type();
            this.match(Id.RightPren, "')' expected");
            return type;
        } else if (this.skipIs(Id.LeftSqrBr)) {
            const firstType = this.type();
            this.match(Id.Comma, "',' expected");
            const secondType = this.type();
            this.match(Id.RightSqrBr, "']' expected");
            return new PairType(firstType, secondType);
        } else if (this.nextIs(Id.Type)) {
            const typeName = this.match(Id.Type, "NOT POSSIBLE");
            if (!isValidTypeName(typeName))
                throw new ParseError(this.tokens[this.currentTokenIndex - 1].start, "type must be Bool or Nat")
            return new SimpleType(typeName);
        } else if (this.nextIs(Id.Identifier)) {
            throw new ParseError(this.currentPosition, "type name must begin with uppercase letter")
        } else {
            throw new ParseError(this.currentPosition, "type expected")
        }
    }
    
    term(): Node {
        if (this.done) {
            throw new ParseError(this.currentPosition, "λ-term expected");
        }
        if (this.skipIs(Id.Lambda)) {
            const id = this.match(Id.Identifier, "λ-abstraction binding expected");
            this.match(Id.Colon, "':' expected");
            const type = this.type();
            this.match(Id.Dot, "'.' expected");
            const body = this.term();
            return new Abstraction(new Identifier(id), type, body);
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