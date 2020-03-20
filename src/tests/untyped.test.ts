import {
	Token,
	tokenize,
	parse as parseTokens,
	equals,
	free,
	bound,
	vars,
	capSubst,
	subst
} from "../untyped";

const parse = (expr: string) => parseTokens(tokenize(expr));

const stringArrayToString = (array: Array<string>) => `[${array.join(", ")}]`;

{
	const invalidId = "identifier must begin with a letter";
	const unexpected = "unexpected character";

	describe.each([
		["λx.x 2x", invalidId],
		["(λx._x)", invalidId],
		["λx.,wfex", unexpected],
		["λx.|x", unexpected]
	])('tokenize("%s")', (expr, error) => {
		test(`throws error: ${error}`, () => {
			expect(() => tokenize(expr)).toThrow(error);
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
		tok(Identifier, 16, "T_true")
	];

	describe.each([
		["(λx.x x) y", toks1],
		["(λx1.λy1.x1 y1) T_true", toks2]
	])('tokenize("%s")', (expr, tokens) => {
		test("works correctly", () => {
			expect(tokenize(expr)).toEqual(tokens);
		});
	});
}

{
	const term = "λ-term expected";
	const binding = "λ-abstraction binding expected";
	const dot = "'.' expected";
	const lambda = "'λ' expected";
	const leftPren = "')' expected";

	describe.each([
		["(", term],
		["λ", binding],
		["λx", dot],
		["λx.", term],
		["λx.(", term],
		["λx.(x ", leftPren],
		["λx..", lambda],
		["λx.x.", lambda],
		[".", lambda],
		["λx.λy", dot],
		["(λx.x) (λ.)", binding],
		["(x y (z f) (a1 b1)", leftPren]
	])('parse("%s")', (expr, error) => {
		test(`throws error: ${error}`, () => {
			expect(() => parse(expr)).toThrow(error);
		});
	});
}

{
	describe.each([
		["(λx.x)", "λx.x"],
		["λx.(x y)", "λx.x y"],
		["(λx.x) (λy.y)", "(λx.x) (λy.y)"],
		["(λx.x z) (((x) y) z)", "(λx.x z) (x y z)"],
		["(a (b c)) e (d f)", "a (b c) e (d f)"]
	])('"%s"', (expr, simpleExpr) => {
		test(`simplified is "${simpleExpr}"`, () => {
			expect(parse(expr).toString()).toBe(simpleExpr);
		});
	});
}

{
	describe.each([
		["λx.x", "λ 1"],
		["λx.λy.x y", "λ λ 2 1"],
		["(λx.x) (λy.y)", "(λ 1) (λ 1)"],
		["(λx.x z) x", "(λ 1 z) x"],
	])('"%s"', (expr, DeBruijnExpr) => {
		test(`in DeBruijn notation is "${DeBruijnExpr}"`, () => {
			expect(parse(expr).toDeBruijnString()).toBe(DeBruijnExpr);
		});
	});
}

{
	describe.each([
		["λx.x", "λy.y", true],
		["λx.λy.x y", "λy.λx.y x", true],
		["x", "y", false],
		["λx.x z", "λy.y z", true]
	])('"%s"', (expr1, expr2, truthValue) => {
		test(`is${truthValue ? " " : " not "}α-equivalent to "${expr2}"`, () => {
			expect(equals(parse(expr1), parse(expr2))).toBe(truthValue);
		});
	});
}

{
	describe.each([
		["λx.x", []],
		["λx.x y", ["y"]],
		["x y", ["x", "y"]],
		["(λx.x) x", ["x"]]
	])('free(%s)', (expr, freeVars) => {
		test(`is ${stringArrayToString(freeVars)}`, () => {
			expect(free(parse(expr))).toEqual(freeVars);
		});
	});
}

{
	describe.each([
		["λx.x", ["x"]],
		["λx.x y", ["x"]],
		["x y", []],
		["(λx.x) x", ["x"]]
	])('bound(%s)', (expr, boundVars) => {
		test(`is ${stringArrayToString(boundVars)}`, () => {
			expect(bound(parse(expr))).toEqual(boundVars);
		});
	});
}

{
	describe.each([
		["λx.x", ["x"]],
		["λx.x y", ["x", "y"]],
		["x y", ["x", "y"]],
		["(λx.x) x", ["x"]]
	])('vars(%s)', (expr, allVars) => {
		test(`is ${stringArrayToString(allVars)}`, () => {
			expect(vars(parse(expr))).toEqual(allVars);
		});
	});
}

{
	describe.each([
		["x", "x", "t", "t"],
		["y", "x", "t", "y"],
		["(λx.x z) (y z)", "z", "t", "(λx.x t) (y t)"],
		["λx.y", "x", "t", "λx.y"],
		["λx.y", "y", "t", "λx.t"]
	])('%s[%s/%s]', (expr, target, value, expectedExpr) => {
		test(`is equal to ${expectedExpr}`, () => {
			const ast1 = capSubst(parse(expr), target, parse(value));
			const ast2 = parse(expectedExpr);
			expect(equals(ast1, ast2)).toBe(true);
		});
	});
}

{
	describe.each([
		["x", "x", "t", "t"],
		["y", "x", "t", "y"],
		["(λx.x z) (y z)", "z", "x", "(λf0.f0 x) (y x)"],
		["λx.y", "x", "t", "λx.y"],
		["λx.y", "y", "x", "λf0.x"]
	])('%s⟦%s/%s⟧', (expr, target, value, expectedExpr) => {
		test(`is equal to ${expectedExpr}`, () => {
			const ast1 = subst(parse(expr), target, parse(value));
			const ast2 = parse(expectedExpr);
			expect(equals(ast1, ast2)).toBe(true);
		});
	});
}