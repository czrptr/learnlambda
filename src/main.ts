const exprs = [
	/* untyped */

	// "λx.λy.((((x y) z) w))",
	// "λx.λy.((((x y) z  w))",
	// "λx.",
	// "λx.(",
	// "λ.x",
	// "λx.(x",
	// "λx.y.x",
	// "y.x",
	// "x 32",
	// "x _y",
	// "g (f (λx.x))",
	// "g f (λx.x)",
	// "(λx.x) y",
	// ".",
	// "(",
	// "(λx. λy. z x (λu. u x)) (λx. w x)",
	// "λx.λy.x y (λx.x w)",
	// "λx.λy.x y w",

	/* typed */

	// "λx:Bool -> [Bool -> (Bool -> Bool), Bool] .x y z w",
	// "λx.x",
	// "λx:.x",
	// "λx:type.x",
	// "λx:Float.x",
	// "λx:[].x",
	// "λx:[Bool,].x",
	// "λx:[, Nat].x",
	// "λx:[Nat, [Nat, Nat]].x",
	// "λx:Bool -> (Bool-> Bool).x",
	// "λx:(Bool -> Bool) -> ((Bool -> Bool) -> Bool).x",
	// "λx:([Nat -> Nat -> Nat, (Bool)]).x",
];

import {
	TokenizeError,
	ParseError,
	tokenize,
	parse,
	evaluate
} from "./untyped";

process.stdin.setEncoding("utf8");

function print(buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean {
	return process.stdout.write(buffer, cb);
};

print("λ> ");
process.stdin.on("data", (buffer) => {
	const input = buffer.toString().trim();
	if (input == "q" || input == "quit")
		process.exit();
	try {
		const expr = parse(tokenize(input.replace("\\", "λ")));
		const evalExpr = evaluate(expr);
		print(`\n${evalExpr}\n${evalExpr.toDeBruijnString()}`);
	} catch (e) {
		print(`\n${input}\n`);
		if (e instanceof TokenizeError || e instanceof ParseError) {
			const [errPos, errMsg] = e.toPrint();
			print(`${errPos}\n${errMsg}`);
		} else
			print("invalid λ-term");
	} finally {
		print("\n\nλ> ");
	}
});