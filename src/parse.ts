import { Token, TokenizeFunction, TokenizeError } from "./tokenize";

export class ParseError extends Error {
	constructor(
		readonly position: number,
		message?: string
	) {
		super(message); 
	}

	print(): void {
		console.log(" ".repeat(this.position) + "^");
		console.error(this.message);
	}
}

export class Parser<T extends Token> {
	private index: number;

	protected get currentTokenIndex(): number {
		return this.index;
	}

	constructor(
		protected readonly tokens: Array<T>
	) {
		this.index = 0;
	}

	protected get currentPosition(): number {
		if (this.index >= this.tokens.length)
			return this.tokens[this.tokens.length - 1].start + 1;
		else
			return this.tokens[this.index].start;
	}

	protected get done(): boolean {
		return this.index >= this.tokens.length;
	}

	nextIs(id: any): boolean {
		if (this.index >= this.tokens.length)
			return false;
		return (this.tokens[this.index].id == id);
	}
	
	skipIs(id: any): boolean {
		if (this.index >= this.tokens.length)
			return false;
		if (this.tokens[this.index].id == id) {
			this.index += 1;
			return true;
		}
		return false;
	}

	match(id: any, error: string): string {
		if (this.nextIs(id)) {
			this.index += 1;
			return this.tokens[this.index - 1].value;
		} else {
			throw new ParseError(this.currentPosition, error);
		}
	}
}