import { TokenizeError } from "./tokenize";
import { ParseError } from "./parse";

let log = console.log;
let err = console.error;

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

import { tokenize, parse, substitute, vars, fresh, Identifier } from "./untyped";
// import { tokenize, parse } from "./typed";

// for (const expr of exprs) {
// 	try {
// 		const tokens = tokenize(expr);
// 		const ast = parse(tokens);
// 		// log(tokens + "");
// 		// log(ast);
// 		log(`"${expr}" -> "${ast} | ${ast.toDeBruijnString()}"`);
// 	} catch (e) {
// 		log(expr);
// 		if (e instanceof TokenizeError || e instanceof ParseError)
// 			e.print();
// 		else
// 			err("invalid λ-term");
// 	}
// }

const expr = parse(tokenize("(λx. λy. z x (λu. u x)) (λx. w x)"));
const target = "w";
const subst = new Identifier("g", 0);
// const subst = parse(tokenize("λx.x"));

const result = substitute(expr, target, subst);

log(`${expr} (${expr.toDeBruijnString()})`);
log(`(${expr})[${target}/${subst}] = ${result} (${result.toDeBruijnString()})`);