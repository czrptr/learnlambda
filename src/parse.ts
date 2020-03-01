import {
	Token
} from "./tokenize";

export class ParseError extends Error {
	constructor(
		public readonly position: number,
		message?: string
	) {
		super(message); 
	}

	public toPrint(): [string, string] {
		return [" ".repeat(this.position) + "^", this.message];
	}
}

class Context {
	private data: Array<string> = [];
	private max: number = 0;

	public get maxIndex(): number {
		return this.max;
	}

	public push(identifier: string): void {
		this.data.push(identifier);
	}

	public pop(): string | undefined {
		return this.data.pop();
	}

	public indexOf(indentifier: string): number {
		let index = this.data.lastIndexOf(indentifier);
		if (index != -1) {
			let ret = this.data.length - index;
			this.max = ret > this.max ? ret : this.max;
			return ret;
		} else {
			return 0;
		}
	}
}

export class Parser<T extends Token> {
	private index: number;
	protected context: Context;

	constructor(
		protected readonly tokens: Array<T>
	) {
		this.index = 0;
		this.context = new Context();
	}

	protected get currentTokenIndex(): number {
		return this.index;
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

	public get maxIndex(): number {
		return this.context.maxIndex;
	}

	public nextIs(id: any): boolean {
		if (this.index >= this.tokens.length)
			return false;
		return (this.tokens[this.index].id == id);
	}
	
	public skipIs(id: any): boolean {
		if (this.index >= this.tokens.length)
			return false;
		if (this.tokens[this.index].id == id) {
			this.index += 1;
			return true;
		}
		return false;
	}

	public match(id: any, error: string): string {
		if (this.nextIs(id)) {
			this.index += 1;
			return this.tokens[this.index - 1].value;
		} else {
			throw new ParseError(this.currentPosition, error);
		}
	}
}