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
	// "(λx.λy.z x (λu. u x)) (λx.w x)",
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
	ExecutionContext,
	tokenize,
	parse,
	evaluate
} from "./untyped";

const log = console.log;

let ctx = new ExecutionContext();
// ctx.aliases.set("true", ctx.evaluate("λx.λy.x"));
// ctx.aliases.set("false", ctx.evaluate("λx.λy.y"));
// ctx.aliases.set("and", ctx.evaluate("λp.λq.p q p"));
// ctx.aliases.set("or", ctx.evaluate("λp.λq.p p q"));
// ctx.aliases.set("not", ctx.evaluate("λp.p false true"));

ctx.aliases.set("zero", ctx.evaluate("λf.λx.x"));
ctx.aliases.set("succ", ctx.evaluate("λn.λf.λx.f (n f x)))"));
ctx.aliases.set("plus", ctx.evaluate("λm.λn.m succ n"));
ctx.aliases.set("one", ctx.evaluate("succ zero"));
ctx.aliases.set("two", ctx.evaluate("succ one"));
ctx.aliases.set("three", ctx.evaluate("succ two"));
ctx.aliases.set("four", ctx.evaluate("succ three"));
ctx.aliases.set("five", ctx.evaluate("succ four"));
ctx.aliases.set("six", ctx.evaluate("succ five"));
ctx.aliases.set("seven", ctx.evaluate("succ six"));
ctx.aliases.set("eight", ctx.evaluate("succ seven"));
ctx.aliases.set("nine", ctx.evaluate("succ eight"));

ctx.aliases.forEach((value, key) => {
	log(`${key} = ${value}`);
	log(`${key} = ${value.toDeBruijnString()}\n`);
});

const ast = ctx.evaluate("plus five four");
log(ast+"\n"+ast.toDeBruijnString()+"\n");

/*
process.stdin.setEncoding("utf8");

function print(buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean {
	return process.stdout.write(buffer, cb);
};

let exeCtx = new ExecutionContext();
exeCtx.aliases.set("true", exeCtx.evaluate("λx.λy.x"));
exeCtx.aliases.set("false", exeCtx.evaluate("λx.λy.y"));

const alias = "([a-z][_0-9a-zA-Z]*)";
const ws = "\\s+"
const letStmt = RegExp(`let${ws}${alias}${ws}=${ws}(.+)`);

// let true = \x.\y.x

print("λ> ");
process.stdin.on("data", (buffer) => {
	const input = buffer.toString().trim().replace(/\\/g, "λ");
	if (input == "q" || input == "quit")
		process.exit();
	if (input == "ctx" || input == "context") {
		print("\n");
		if (exeCtx.aliases.size != 0) {
			exeCtx.aliases.forEach((value, key) => {
				print(`${key} = ${value}\n`);
			});
		} else {
			print("context is empty\n");
		}
		print("\nλ> ");
		return;
	}
	const matches = input.match(letStmt);
	if (matches != null) {
		try {
			const expression = exeCtx.evaluate(matches[2]);
			exeCtx.aliases.set(matches[1], expression);
			print("\nλ> ");
		} catch (e) {
			print(`\n${matches[2]}\n`);
			if (e instanceof TokenizeError || e instanceof ParseError) {
				const [errPos, errMsg] = e.toPrint();
				print(`${errPos}\n${errMsg}`);
			} else
				print("invalid λ-term");
			print("\n\nλ> ");
		}
	} else {
		try {
			const expression = exeCtx.evaluate(input);
			print(`\n${expression}\n${expression.toDeBruijnString()}`);
			print("\n\nλ> ");
		} catch (e) {
			print(`\n${input}\n`);
			if (e instanceof TokenizeError || e instanceof ParseError) {
				const [errPos, errMsg] = e.toPrint();
				print(`${errPos}\n${errMsg}`);
			} else
				print("invalid λ-term");
			print("\n\nλ> ");
		}
	}
});
*/