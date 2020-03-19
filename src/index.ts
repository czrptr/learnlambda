import { TokenizeError, tokenize, ParseError, parse } from "./untyped";

const log = console.log;

const expr = "λx.x.";
try {
	const ast = parse(tokenize(expr));
} catch (e) {
	if (e instanceof TokenizeError || e instanceof ParseError) {
		const info = e.toPrint();
		log(`${expr}\n${info[0]}\n${info[1]}`);
	}
}