let level = 0;

export module logger {
    export function getLevel() {
		return level;
	}

	export function setLevel(x: number) {
		level = x;
	}

	export function log(...args: any[]) {
        let al = args.shift();
		if (al >= level)
			console.log(new Error().stack!.split('\n')[2].substr(7), ...args);
	}
}
