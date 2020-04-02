/* ====== CodeMirror setup ====== */

import CodeMirror, {
	EditorConfiguration,
	Editor,
	Pos
} from "codemirror";

import "./cm/untyped";

function initCodeMirror(
	elementId: string,
	config: EditorConfiguration | undefined
): [Editor, HTMLElement] {
	var htmlElement = document.getElementById(elementId)! as HTMLTextAreaElement;
	var editor = CodeMirror.fromTextArea(htmlElement, config);
	var codeMirrorElement = htmlElement.nextSibling! as HTMLElement;
	htmlElement.parentNode!.removeChild(htmlElement);
	codeMirrorElement.style.gridArea = elementId;
	
	return [editor, codeMirrorElement];
}

var termianlElement = document.getElementById("terminal")!;

var [input, inputElement] = initCodeMirror("input", {
	lineWrapping: false,
	scrollbarStyle: "null",
	mode: "untyped",
});

var [history, historyElement] = initCodeMirror("history", {
	lineWrapping: true,
	// scrollbarStyle: "null",
	readOnly: "nocursor",
	mode: "untyped",
});

var [context, contextElement] = initCodeMirror("context", {
	lineWrapping: true,
	// scrollbarStyle: "null",
	readOnly: "nocursor",
	mode: "untyped",
});

input.focus();

/* ====== Interpreter ====== */

import { ParseError, ExecutionContext } from "./untyped";

function refreshContext(): void {
	let display = "Context:\n\n";
	for (let [alias, expr] of exeContext.aliasesAsStrings)
		display += alias + " → " + expr + "\n\n";
	display = display.trimRight();

	context.setValue(display);
}

function strip(str: string): string {
	const accept = /[^λ.()_0-9'a-zA-Z =]/g;
	return str.replace(accept, "");
}

let exeContext = new ExecutionContext();
exeContext.addAlias("true", "λx.λy.x");
exeContext.addAlias("false", "λx.λy.y");
exeContext.addAlias("not", "λp.p false true");
exeContext.addAlias("and", "λp.λq.p q p");
exeContext.addAlias("or", "λp.λq.p p q");

// exeContext.addAlias("zero", "λf.λx.x");
exeContext.addAlias("succ", "λn.λf.λx.f (n f x)");
exeContext.addAlias("plus", "λm.λn.m succ n");
exeContext.addAlias("pow", "λb.λe.e b");
exeContext.addAlias("one", "succ false");
exeContext.addAlias("two", "succ one");
exeContext.addAlias("three", "succ two");
exeContext.addAlias("four", "succ three");
exeContext.addAlias("five", "succ four");
exeContext.addAlias("six", "succ five");
exeContext.addAlias("seven", "succ six");
exeContext.addAlias("eight", "succ seven");
exeContext.addAlias("nine", "succ eight");
exeContext.addAlias("ten", "succ nine");

refreshContext();

input.on("beforeChange", (sender, change) => {
	const addInstr = /([a-z][_0-9'a-z]*)\s=\s(.+)/i;
	const delInstr = /del\s([a-z][_0-9'a-z]*)/i; 

	const hist = history.getValue().length != 0 ? history.getValue() + "\n\n" : "";

	// enter was pressed
	if (change.text.length == 2 && change.text[0] == "" && change.text[1] == "") {
		change.cancel();
		const expr = sender.getValue().trim();

		let match = expr.match(addInstr);
		if (match) {
			exeContext.addAlias(match[1], match[2]);
			refreshContext();

			history.setValue(hist + match[1] + " → " + match[2] + " added to context");
			history.scrollIntoView(Pos(history.lineCount() - 1, 0));
			sender.setValue("");

			return;
		}
		match = expr.match(delInstr);
		if (match) {
			console.log(match[1]);
			exeContext.removeAlias(match[1]);
			refreshContext();

			history.setValue(hist + match[1] + " removed from context");
			history.scrollIntoView(Pos(history.lineCount() - 1, 0));
			sender.setValue("");

			return;
		}

		try {
			const result = exeContext.evaluate(expr);
			history.setValue(hist + "λ> " + result);
			history.scrollIntoView(Pos(history.lineCount() - 1, 0));
		} catch (e) {
			if (e instanceof ParseError) {
				history.setValue(hist + "ε> " + expr + "\n   " + e.positionString + "\n" + e.message);
			}
		}
		sender.setValue("");
	}

	const input = change.text.map(line => strip(line.replace(/\\/g, "λ")));
	change.update!(undefined, undefined, input);
});