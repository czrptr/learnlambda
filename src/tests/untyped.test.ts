import { Token, tokenize, parse as parseTokens } from "../untyped";

const parse = (expression: string) => parseTokens(tokenize(expression));

{
	const invalidId = "identifier must begin with a letter";
	const unexpected = "unexpected character";

	describe.each([
		["λx.x 2x", invalidId],
		["(λx._x)", invalidId],
		["λx.,wfex", unexpected],
		["λx.|x", unexpected],
	])('tokenization of "%s")', (expression, error) => {
		test(`throws error: ${error}`, () => {
			expect(() => tokenize(expression)).toThrow(error);
		});
	});
}

{
	const Dot = Token.Id.Dot
	const Lambda = Token.Id.Lambda;
	const LeftPren = Token.Id.LeftPren;
	const RightPren = Token.Id.RightPren;
	const Identifier = Token.Id.Identifier;

	function tok(id: any, start: number, value: string) {
		return new Token(id, start, value);
	}

	const toks1 = [
		tok(LeftPren, 0, "("),
		tok(Lambda, 1, "λ"),
		tok(Identifier, 2, "x"),
		tok(Dot, 3, "."),
		tok(Identifier, 4, "x"),
		tok(Identifier, 6, "x"),
		tok(RightPren, 7, ")"),
		tok(Identifier, 9, "y")
	];

	const toks2 = [
		tok(LeftPren, 0, "("),
		tok(Lambda, 1, "λ"),
		tok(Identifier, 2, "x1"),
		tok(Dot, 4, "."),
		tok(Lambda, 5, "λ"),
		tok(Identifier, 6, "y1"),
		tok(Dot, 8, "."),
		tok(Identifier, 9, "x1"),
		tok(Identifier, 12, "y1"),
		tok(RightPren, 14, ")"),
		tok(Identifier, 16, "T_true"),
	];

	describe.each([
		["(λx.x x) y", toks1],
		["(λx1.λy1.x1 y1) T_true", toks2]
	])('tokenization of "%s"', (expression, tokens) => {
		test("works correctly", () => {
			expect(tokenize(expression)).toEqual(tokens);
		});
	});
}

{
	const termExpected = "λ-term expected";
	const bindingExpected = "λ-abstraction binding expected";
	const dotExpected = "'.' expected";
	const lambdaExpected = "'λ' expected";
	const leftPrenExpected = "')' expected";

	describe.each([
		["(", termExpected],
		["λ", bindingExpected],
		["λx", dotExpected],
		["λx.", termExpected],
		["λx.(", termExpected],
		["λx.(x ", leftPrenExpected],
		["λx..", lambdaExpected],
		["λx.x.", lambdaExpected],
		[".", lambdaExpected],
		["λx", dotExpected],
		["λx.λy", dotExpected],
		["(λx.x) (λ.)", bindingExpected],
		["(x y (z f) (a1 b1)", leftPrenExpected]
	])('parsing of "%s"', (expression, error) => {
		test(`throws error: ${error}`, () => {
			expect(() => parse(expression)).toThrow(error);
		});
	});
}

// TODO add removal of unneded pharantesis tests

{
	describe.each([
		["λx.x", "λ 1"],
		["λx.λy.x y", "λ λ 2 1"],
		["(λx.x) (λy.y)", "(λ 1) (λ 1)"],
		["(λx.x z) x", "(λ 1 z) x"],
	])('parsing of "%s"', (expression, expectedDeBruijnString) => {
		test(`in DeBruijn notation is "${expectedDeBruijnString}"`, () => {
			expect(parse(expression).toDeBruijnString()).toBe(expectedDeBruijnString);
		});
	});
}