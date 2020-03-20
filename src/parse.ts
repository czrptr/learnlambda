class ParseError extends Error {
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
	private toSwap: Map<string, string> = new Map();

	public get ids(): Array<string> {
		return this.data;
	}

	public addSwap(id1: string, id2: string): void {
		this.toSwap.set(id1, id2);
	}

	public removeSwap(id: string): void {
		this.toSwap.delete(id);
	}

	public getSwap(id: string): string {
		return this.toSwap.has(id) ? this.toSwap.get(id)! : id;
	} 

	public push(identifier: string): void {
		this.data.push(identifier);
	}

	public pop(): void {
		let _ = this.data.pop();
	}

	public indexOf(indentifier: string): number {
		let index = this.data.lastIndexOf(indentifier);
		return (index != -1) ? this.data.length - index : 0;
	}
}

import { Token } from "./tokenize";

class Parser<T extends Token> {
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

export {
	ParseError,
	Parser
};