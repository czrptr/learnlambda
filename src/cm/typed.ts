import * as CodeMirror from "codemirror";

CodeMirror.defineMode("untyped", () => {
	return {
		startState: () => { return { parens: [-1] } },
		token: (stream, state) => {
			if (stream.match(/^[a-z][_0-9a-zA-Z]*/, true))
				return "identifier";

				if (stream.match(/^[A-Z][a-z]*/, true))
				return "datatype";
			
			if (stream.match("'('", true))
				return null;

			switch (stream.peek()) {
			case "λ": {
				stream.next();
				return "lambda";
			}
			case ".": {
				stream.next();
				return "dot";
			}
			case ":": {
				stream.next();
				return "dot";
			}
			case "(": {
				stream.next();
				const id = state.parens[state.parens.length - 1]; 
				state.parens.push((id + 1) % 10);
				return `paren${id + 1}`;
			}
			case ")": {
				stream.next();
				if (state.parens.length == 1)
					return null;
				
				const id = state.parens.pop()!;
				return `paren${id}`;
			}
			default: {
				stream.next();
				return null;
			}
			}
		}
	};
});