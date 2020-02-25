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
	// "g f (λx.x)", // FIX ME
	// "(λx.x) y",
	// "λx.λy.(x y) ((z w) x)",
	// ".",
	// "(",

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
	"λx:([Nat -> Nat -> Nat, (Bool)]).x",
];

// import { tokenize, parse } from "./untyped";
import { tokenize, parse } from "./typed";

for (const expr of exprs) {
	try {
		const tokens = tokenize(expr);
		const ast = parse(tokens);
		// log(tokens + "");
		// log(ast);
		log(`"${expr}" -> "${ast}"`);
	} catch (e) {
		log(expr);
		if (e instanceof TokenizeError || e instanceof ParseError)
			e.print();
		else
			err("invalid λ-term");
	}
}