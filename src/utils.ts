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

export function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

export function arrayEqual<T>(arr1: T[], arr2: T[]): boolean {
	if (arr1 === arr2) return true;
	if (arr1 == undefined || arr2 == undefined) return false;
	if (arr1.length != arr2.length) return false;

	// clone and sort for order independence equality

	for (let i = 0; i < arr1.length; i += 1)
		if (arr1[i] !== arr2[i]) return false;
	return true;
}