let level = 0;

module.exports = {
	getLevel() {
		return level;
	},

	setLevel(x) {
		level = x;
	},

	log() {
		let args = Object.values(arguments);
		let al = args.shift();
		if (al >= level)
			console.log(new Error().stack.split('\n')[2].substr(7), ...args);
	}
}
