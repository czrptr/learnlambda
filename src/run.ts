import {
	tokenize,
	parse, 
	ExecutionContext,
	evaluate,
	ParseError
} from "./untyped";

const log = console.log;

let ctx = new ExecutionContext();
// ctx.addAlias("true", "λx.λy.x");
// ctx.addAlias("false", "λx.λy.y");
// ctx.addAlias("not", "λp.p false true");
// ctx.addAlias("and", "λp.λq.p q p");
// ctx.addAlias("or", "λp.λq.p p q");

// // ctx.addAlias("zero", "λf.λx.x");
// ctx.addAlias("succ", "λn.λf.λx.f (n f x)");
// ctx.addAlias("plus", "λm.λn.m succ n");
// ctx.addAlias("pow", "λb.λe.e b");
// ctx.addAlias("one", "succ false");
// ctx.addAlias("two", "succ one");
// ctx.addAlias("three", "succ two");
// ctx.addAlias("four", "succ three");
// ctx.addAlias("five", "succ four");
// ctx.addAlias("six", "succ five");
// ctx.addAlias("seven", "succ six");
// ctx.addAlias("eight", "succ seven");
// ctx.addAlias("nine", "succ eight");
// ctx.addAlias("ten", "succ nine");

const expr = "x λx.x"; //λ
try {
	const ast = parse(tokenize(expr));
	log(ast);
	log(evaluate(ast)+"");
} catch (e) {
	if (e instanceof ParseError) {
		log(expr);
		log(e.positionString);
		log(e.message);
	}
}