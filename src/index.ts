import { ParseError, ExecutionContext } from "./untyped";

let ctx = new ExecutionContext();
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
ctx.addAlias("ten", "succ nine");

import CodeMirror from "codemirror";
import "./cm/untyped";

const Pos = CodeMirror.Pos;
const prompt = "i> ";

var editor = CodeMirror(document.getElementById("editor")!, {
	lineWrapping: false,
	scrollbarStyle: "null",
	mode: "untyped",
});
editor.setSize(null, "1.6em");

var history = CodeMirror(document.getElementById("history")!, {
	lineWrapping: true,
	readOnly: true,
	mode: "untyped",
});
history.setSize(null, "50vh");

var context = CodeMirror(document.getElementById("context-content")!, {
	lineWrapping: true,
	readOnly: true,
	mode: "untyped",
});
context.setSize(null, document.getElementById("history")!.clientHeight);

for (let [alias, expr] of ctx.aliasesAsStrings)
	context.setValue(context.getValue() + `${alias} → ${expr}\n\n`);
context.setValue(context.getValue().trimRight());

function strip(str: string): string {
	const accept = /[^λ.()_0-9'a-zA-Z ]/g;
	return str.replace(accept, "");
}

editor.on("beforeChange", (sender, change) => {
	// console.log(change.text);

	// enter was pressed
	if (change.text.length == 2 && change.text[0] == "" && change.text[1] == "") {
		change.cancel();
		const expr = editor.getValue().trim();
		const hist = history.getValue().length != 0 ? history.getValue() + "\n\n" : "";
		try {
			const result = ctx.evaluate(expr);

			history.setValue(hist + "λ> " + result);
			history.scrollIntoView(Pos(history.lineCount() - 1, 0));
		} catch (e) {
			if (e instanceof ParseError) {
				history.setValue(hist + "ε> " + expr + "\n   " + e.positionString + "\n" + e.message);
			}
		}
		editor.setValue("");
	}

	const input = change.text.map(line => strip(line.replace(/\\/g, "λ")));
	change.update!(undefined, undefined, input);
});

editor.focus();