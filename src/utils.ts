interface Array<T> {
	last(): T | undefined;
}

Array.prototype.last = function <T>(this: Array<T>): T | undefined {
	return this.length > 0 ? this[this.length - 1] : undefined;
}