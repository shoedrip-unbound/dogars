let cp = require('child_process');
let streamToPromise = require('stream-to-promise');

class Notes {	
	async get() {
		let proc = cp.spawn('git', [
			'log',
			'--pretty=format:%h|||%N|||%s|||%ar|',
		]);
		let buff = await streamToPromise(proc.stdout);
		buff = buff.toString().split('|\n');
		console.log(buff)
		let arr = [];
		for (let commit of buff) {
			let c = commit.split('|||');
			arr.push({commit: c[0],
					  type: c[1],
					  msg: c[2],
					  reldate: c[3]});
		}
		return arr.filter(note => note.msg != '');
	}
}

module.exports = new Notes();
