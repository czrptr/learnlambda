import { ParseError } from "./utils";

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

	protected get currentTokenIndex(): number {
		return this.index;
	}

	protected get currentPosition(): number {
		if (this.index >= this.tokens.length)
			return this.tokens[this.tokens.length - 1].start + this.tokens[this.tokens.length - 1].value.length;
		else
			return this.tokens[this.index].start + this.tokens[this.index].value.length;
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