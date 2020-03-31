export class ParseError extends Error {
	constructor(
		public readonly position: number,
		message?: string
	) {
		super(message);
	}

	get positionString(): string {
		return " ".repeat(this.position) + "^";
	}
}

export function last<T>(array: Array<T>): T | undefined {
	return array.length > 0 ? array[array.length - 1] : undefined;
}