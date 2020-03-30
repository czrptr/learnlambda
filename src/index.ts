import { ExecutionContext } from "./untyped";

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
import { ParseError } from "./parse";
import { TokenizeError } from "./tokenize";

const Pos = CodeMirror.Pos;

var editor = CodeMirror(document.getElementById("editor")!, {
	dragDrop: false,
	lineWrapping: false,
	scrollbarStyle: "null",
	mode: "untyped",
});
editor.setSize(null, "1.6em");
// editor.setValue(prompt)
// editor.getDoc().setCursor(0, prompt.length);

var history = CodeMirror(document.getElementById("history")!, {
	lineWrapping: true,
	readOnly: true,
	mode: "untyped",
});
history.setSize(null, "100%");

function strip(str: string): string {
	const accept = /[^λ.()_0-9a-zA-Z ]/g;
	return str.replace(accept, "");
}

editor.on("beforeChange", (sender, change) => {
	console.log(change.text);

	// backspace was pressed
	// if (change.text.length == 1 && change.text[0] == "") {
	// 	if (change.to.ch == 2)
	// 		change.cancel();
	// }

	// enter was pressed
	if (change.text.length == 2 && change.text[0] == "" && change.text[1] == "") {
		change.cancel();
		const expr = editor.getValue().trim();
		try {
			const result = ctx.evaluate(expr);
			history.setValue(history.getValue() + "λ> " + result + "\n\n");
			history.scrollIntoView(Pos(history.lineCount() - 1, 0));
		} catch (e) {
			if (e instanceof TokenizeError || e instanceof ParseError) {
				const info = e.toPrint();
				history.setValue(history.getValue() + "ε> " + expr + "\n   " + info[0] + "\n");
				history.setValue(history.getValue() + info[1] + "\n\n")
			}
		}
		editor.setValue("");
	}

	const input = change.text.map(line => strip(line.replace(/\\/g, "λ")));
	change.update!(undefined, undefined, input);
});

editor.focus();