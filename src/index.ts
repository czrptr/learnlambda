import { TokenizeError, tokenize, ParseError, parse, subst, evalOnce, evaluate, ExecutionContext } from "./untyped";

const log = console.log;

function setupContext(ctx: ExecutionContext): void {
	ctx.addAlias("true", "λx.λy.x");
	ctx.addAlias("false", "λx.λy.y");
	ctx.addAlias("not", "λp.p false true");
	ctx.addAlias("and", "λp.λq.p q p");
	ctx.addAlias("or", "λp.λq.p p q");

	// ctx.addAlias("zero", "λf.λx.x");
	ctx.addAlias("succ", "λn.λf.λx.f (n f x)");
	ctx.addAlias("plus", "λm.λn.m succ n");
	ctx.addAlias("pow", "λb.λe.e b");
	ctx.addAlias("one", "succ false");
	ctx.addAlias("two", "succ one");
	ctx.addAlias("three", "succ two");
	ctx.addAlias("four", "succ three");
	ctx.addAlias("five", "succ four");
	ctx.addAlias("six", "succ five");
	ctx.addAlias("seven", "succ six");
	ctx.addAlias("eight", "succ seven");
	ctx.addAlias("nine", "succ eight");
}

let ctx = new ExecutionContext();
setupContext(ctx);

const expr = "pow four four";
// const expr = "(λf.λx.f (f (f (f x)))) (λf.λx.f (f (f (f x))))";
try {
	console.time("eval");
	const ast = ctx.evaluate(expr);
	// const ast = evaluate(parse(tokenize(expr)));
	console.timeEnd("eval");
	log(ast.toString());
	// log(ast.toString().match(/x/g)!.length - 1);
} catch (e) {
	if (e instanceof TokenizeError || e instanceof ParseError) {
		const info = e.toPrint();
		log(`${expr}\n${info[0]}\n${info[1]}`);
	}
}