import { ParseError } from "./utils";

export interface Token {
	readonly id: any;
	readonly start: number;
	readonly value: string;
}

export type TokenizeFunction<T extends Token> = (tokens: Array<T>, expression: string, pos: number) => void;

export function tokenize<T extends Token>(expression: string, rules: Array<[RegExp, TokenizeFunction<T>]>): Array<T> {
	const separator = /^\s+/;

	let result: Array<T> = [];
	let temp: Array<T> = [];
	let i = 0;
	while (i < expression.length) {
		let separation = expression.substr(i).match(separator);
		if (separation) {
			result = [...result, ...temp];
			temp = [];
			i += separation[0].length;
		} else {
			let matched = false;
			for (let rule of rules) {
				let subexpression = expression.substr(i).match(rule[0]);
				if (subexpression) {
					rule[1](temp, subexpression[0], i);
					i += subexpression[0].length;
					matched = true;
					break;
				}
			}
			if (!matched) {
				throw new ParseError(i, `unexpected character: ${expression[i]}`)
			}
		}
	}
	return [...result, ...temp];
}