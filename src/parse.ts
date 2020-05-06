import { ParseError, clamp } from "./utils";

class Context {
	private data: Array<string> = [];
	private toSwap: Map<string, string> = new Map();

	get ids(): Array<string> {
		return this.data;
	}

	addSwap(id1: string, id2: string): void {
		this.toSwap.set(id1, id2);
	}

	removeSwap(id: string): void {
		this.toSwap.delete(id);
	}

	getSwap(id: string): string {
		return this.toSwap.has(id) ? this.toSwap.get(id)! : id;
	} 

	push(identifier: string): void {
		this.data.push(identifier);
	}

	pop(): void {
		let _ = this.data.pop();
	}

	indexOf(indentifier: string): number {
		let index = this.data.lastIndexOf(indentifier);
		return (index != -1) ? this.data.length - index : 0;
	}
}

import { Token } from "./tokenize";

export class Parser<T extends Token> {
	private index: number;
	protected context: Context;

	constructor(
		protected readonly tokens: Array<T>
	) {
		this.index = 0;
		this.context = new Context();
	}

	protected get matchedTokenStart(): number {
		return this.tokens[Math.max(0, this.index - 1)].start;
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

	match(id: any, error: string = "NOT POSSIBLE", tokenOffset: number = 0): string {
		if (this.nextIs(id)) {
			this.index += 1;
			return this.tokens[this.index - 1].value;
		} else {
			const index = Math.min(this.index + tokenOffset, this.tokens.length - 1);
			throw new ParseError(this.tokens[index].start + this.tokens[index].value.length, error);
		}
	}

	raiseParseError(error: string, tokenOffset: number = 0): never {
		const index = clamp(this.index + tokenOffset, 0, this.tokens.length - 1);
		throw new ParseError(this.tokens[index].start + this.tokens[index].value.length, error);
	}
}