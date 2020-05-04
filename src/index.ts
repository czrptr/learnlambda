/* ====== CodeMirror setup ====== */

import CodeMirror, {
	EditorConfiguration,
	Editor,
	Pos
} from "codemirror";

import "./cm/untyped";

function initCodeMirror(
	elementId: string,
	config: EditorConfiguration | undefined,
	setGrid: boolean = false
): [Editor, HTMLElement] {
	var htmlElement = document.getElementById(elementId)! as HTMLTextAreaElement;
	var editor = CodeMirror.fromTextArea(htmlElement, config);
	var codeMirrorElement = htmlElement.nextSibling! as HTMLElement;
	htmlElement.parentNode!.removeChild(htmlElement);
	codeMirrorElement.id = elementId;

	if (setGrid)
		codeMirrorElement.style.gridArea = elementId;

	return [editor, codeMirrorElement];
}

var termianlElement = document.getElementById("terminal")!;

var [history, historyElement] = initCodeMirror("history", {
	lineWrapping: true,
	readOnly: "nocursor",
	mode: "untyped",
	viewportMargin: Infinity,
});
historyElement.style.height = "0";

var [input, inputElement] = initCodeMirror("input", {
	lineWrapping: true,
	mode: "untyped",
	viewportMargin: Infinity,
});

function getFontSize(parentElement: HTMLElement)
{
    var div = document.createElement('div');
    div.style.width = "1000em";
    parentElement.appendChild(div);
    var pixels = div.offsetWidth / 1000;
    parentElement.removeChild(div);
    return pixels;
}

inputElement.style.height = "auto";
inputElement.style.width = `${historyElement.clientWidth - 1.8 * getFontSize(inputElement)}px`;
// inputElement.style.width = `calc(${historyElement.clientWidth}px - 1.8em`;
input.focus();

var [context, contextElement] = initCodeMirror("context", {
	lineWrapping: true,
	readOnly: "nocursor",
	mode: "untyped",
}, true);

function appendHistory(text: string): void {
	history.setValue((history.getValue() + "\n\n" + text).trim());
}

/* ====== Interpreter ====== */

import {
	ParseError,
	ExecutionContext
} from "./untyped";

function refreshContext(): void {
	let display = "Context\n\n";
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

let checkModeElement = document.getElementById("check-mode")! as HTMLInputElement;
function verboseMode(): boolean {
	return checkModeElement.checked;
}

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

let inputHistory: string[] = [];
let inputHistoryIndex = 0;

input.on("beforeChange", (sender, change) => {
	const setStyle = () => {
		inputElement.style.marginTop = "0.55em";
		historyElement.style.height = "auto";
	};

	// console.log(change);

	const delInstr = /del\s([a-z][_0-9'a-z]*)/i;	

	// enter was pressed
	if (change.text.length == 2 && change.text[0] == "" && change.text[1] == "") {
		change.cancel();
		const expr = sender.getValue().trim();

		// clear command
		if (expr == "cls" || expr == "clear") {
			history.setValue("");
			sender.setValue("");
			historyElement.style.height = "0";
			return;
		}

		// add command
		const eqx = expr.indexOf("=");
		if (eqx != -1) {
			let id = expr.substring(0, eqx).trimRight();
			let match = id.match(/[a-z][_0-9'a-z]*/i)
			if (!(match && match[0].length == id.length)) {
				appendHistory("ε> invalid alias identifier");
				sender.setValue("");
				setStyle();

				inputHistory.push(expr);
				inputHistoryIndex = inputHistory.length;
				return;
			}

			let term = expr.substring(eqx + 1).trimLeft();
			try {
				exeContext.addAlias(id, term);
				refreshContext();
				appendHistory("c> " + id + " → " + term + " added to context");
			} catch (e) {
				if (e instanceof ParseError)
					appendHistory("ε> " + term + "\n   " + e.positionString + "\n" + e.message);
			}

			sender.setValue("");
			setStyle();

			inputHistory.push(expr);
			inputHistoryIndex = inputHistory.length;
			return;
		}

		// del command
		let match = expr.match(delInstr);
		if (match) {
			console.log(match[1]);
			if (exeContext.removeAlias(match[1])) {
				refreshContext();
				appendHistory("c> " + match[1] + " removed from context");
			} else {
				appendHistory("ε> " + match[1] + " is not in context");
			}
			sender.setValue("");
			setStyle();

			inputHistory.push(expr);
			inputHistoryIndex = inputHistory.length;
			return;
		}

		// eval command
		try {
			if (verboseMode()) {
				const result = exeContext.verboseEvaluate(expr);
				for (const [type, expr] of result) {
					appendHistory(type + " " + expr);
				}
			} else {
				const result = exeContext.evaluate(expr);
				appendHistory("λ> " + result);
			}
		} catch (e) {
			if (e instanceof ParseError) {
				appendHistory("ε> " + expr + "\n   " + e.positionString + "\n" + e.message);
			}
		}
		sender.setValue("");

		inputHistory.push(expr);
		inputHistoryIndex = inputHistory.length;
		setStyle();
	}

	// strip input of unaccepted characters and replace "\" with "λ"
	const input = change.text.map(line => strip(line.replace(/\\/g, "λ")));
	change.update!(undefined, undefined, input);

	// scrol terminal
	// web dev is a bad joke
	setTimeout(() => {
		termianlElement.scrollTop = termianlElement.scrollHeight;
	}, 0);
});


input.on("keyHandled", (instance, name, event) => {
	if (name == "Up") {
		inputHistoryIndex = Math.max(0, inputHistoryIndex - 1);
		input.setValue(inputHistory[inputHistoryIndex]);
	}

	if (name == "Down") {
		if (inputHistoryIndex == inputHistory.length) {
			input.setValue("");
		} else {
			inputHistoryIndex = Math.min(inputHistory.length, inputHistoryIndex + 1);
			input.setValue(inputHistory[inputHistoryIndex]);
		}
	}
});