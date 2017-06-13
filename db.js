/* global require console */

let Client   = require('mysql');
let fs       = require('fs');
let poke     = require('./poke-utils');
let tripcode = require('tripcode');
let settings = JSON.parse(fs.readFileSync('settings.json'));
let p        = require('util').promisify;

let c = Client.createConnection(settings.db);

let total = 0;

c.query('SELECT COUNT(*) FROM Sets', (e, rows) => {
	if (e)
		throw e;
	total = rows[0]['COUNT(*)'];
	total = parseInt(total);
	module.exports.total = total;
});

let getAllSets = async => c.query('select * from Sets');

let memesInReplay = p((rid, cb) => {
	c.query('select * from memes.Sets where id in (select idset from memes.sets_in_replays where idreplay = ?)', [rid], cb);
});

let getReplays = p((cb) => {
	c.query('select * from replays order by id desc;', cb);
})

let getChampFromTrip = p((trip, cb) => {
	c.query('select * from memes.champs where trip = ? order by id desc;',
			[trip],
			cb);
})

let getChamps = p(cb => {
	c.query('select * from memes.champs order by wins desc;', cb);
})

let createChampFromTrip = p((name, trip, cb) => {
	c.query('insert into memes.champs (name, trip) values (?, ?) ', [name || '', trip], cb);
})

let addReplay = p((data, cb) => {
	c.query('insert into replays (link, description) values (?, ?);', [data.link, data.description] , cb);
})

let getSetsPage = p((setPerPage, pageNumber, cb) => {
	let offset = setPerPage * pageNumber;
	c.query('select * from Sets order by id desc limit ? offset ?;', [~~setPerPage, ~~offset], cb);
})

let addSetToReplay = p((setid, rid, cb) => {
	c.query('insert into memes.sets_in_replays (idreplay, idset) values (?, ?)', [rid, setid], cb);
})

let updateChampAvatar = p((trip, aid, cb) => {
	c.query('update memes.champs set avatar = ? where trip = ?',
			[aid, trip], cb);
})

let registerChampResult = p(async (battleData, hasWon, cb) => {
	let replayurl;

	if (hasWon) {
		poke.saveReplay(battleData.champ.champ_battle, () => {
			console.log('replay saved');
		});
		replayurl = 'http://replay.pokemonshowdown.com/' + battleData.roomid;
	}

	let inc = hasWon ? 'wins' : 'loses';
	let champ = await getChampFromTrip(battleData.champ.champ_trip);
	if (champ.length == 0) {
		await createChampFromTrip(battleData.champ.champ_name, battleData.champ.champ_trip)
	}

	await c.query('update memes.champs set ' + inc + ' = ' + inc + ' + 1 where trip = ?', [battleData.champ.champ_trip]);
	updateChampAvatar(battleData.champ.champ_trip, battleData.champ.avatar.substr(battleData.champ.avatar[0] == '#'));
	if (!hasWon)
		return;
	let info = await addReplay({
		link: replayurl,
		description: 'Automatically uploaded replay. Champ: ' + battleData.champ.champ_name + ' ' + battleData.champ.champ_trip
	});
	for(var i = 0; i < battleData.memes.length; ++i) {
		let sets = await getSetsByPropertyExact({name: battleData.memes[i].name});
		if (sets.length < 1)
			return;
		sets = sets[0];
		addSetToReplay(sets.id, info.insertId, cb);
	}
})

let getSetById = p((id, cb) => {
	c.query('select * from Sets where id = ?', [id], cb);
})

let getSetsByProperty = p((props, cb) => {
	let querystr = 'select * from Sets where ';
	let data = [];
	for(var i in props) {
		querystr += '?? like ? and ';
		data.push(i);
		data.push('%' + props[i] + '%');
	}
	querystr = querystr.substr(0, querystr.length - 5);
	c.query(querystr, data, cb);
})

let getSetsByPropertyExact = p((props, cb) => {
	let querystr = 'select * from Sets where ';
	let data = [];
	for(var i in props) {
		querystr += '?? = ? and ';
		data.push(i);
		data.push(props[i]);
	}
	querystr = querystr.substr(0, querystr.length - 5);
	c.query(querystr, data, cb);
})

let getSetsByName = p((name, cb) => {
	let pattern = '%' + name + '%';
	c.query('select * from Sets where name like ? or species like ? or move_1 like ? or move_2 like ? or move_3 like ? or move_4 like ?',
			[pattern,
			 pattern, pattern, pattern, pattern,
			 pattern], cb);
})

let createNewSet = p((request, cb) => {
	let row = {};
	row.hash = tripcode(request.body.trip);
	row.format = "gen7ou";
	let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
				   "nu", "pu", "lc", "cap"];
	formats.forEach(f => {
		if (request.body.format == f)
			row.format = f;
	});
	row.creator = request.body.creat.substr(0, 23);
	row.description = request.body.desc.substr(0, 230);
	row.date_added = +new Date();

	try {
		let pok = poke.parseSet(request.body.set);
		for(var i in pok)
			row[i] = pok[i];
	}
	catch(e) {
		return cb(e);
	}
	let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
				'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
				'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
				'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
				'spd_iv', 'spe_iv', 'description'];
	let data_arr = [];
	let querystr = 'INSERT INTO Sets (';
	data.forEach(attr => {
		data_arr.push(row[attr]);
		querystr += attr;
		if (attr != 'description')
			querystr += ', ';
	})
	querystr += ') VALUES (';
	data.forEach(attr => {
		querystr += '?';
		if (attr != 'description')
			querystr += ', ';
	});
	querystr += ')';
	c.query(querystr, data_arr, async (e, rows) => {
		if (e)
			return cb(e);
		module.exports.total++;
		let set = await getSetById(rows.insertId);
		set = poke.formatSetFromRow(set[0]);
		let errors = await poke.checkSet(set);
		if (errors) {
			await deleteSet({params: {id: set.id},
							 body: {trip: settings.admin_pass}});
			cb(errors, null);
		} else {
			cb(null, rows);
		}
	});
})

let updateSet = p(async (request, cb) => {
	let row = await getSetById(request.params.id);
	row = row[0];
	if (request.body.trip == '' || (request.body.trip != settings.admin_pass && row.hash != tripcode(request.body.trip)))
		return cb('Wrong tripcode');
	
	row.format = "gen7ou";
	let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
				   "nu", "pu", "lc", "cap"];
	formats.forEach(f => {
		if (request.body.format == f)
			row.format = f;
	});
	row.description = request.body.desc.substr(0, 230);
	row.date_added = +new Date();

	try {
		let pok = poke.parseSet(request.body.set);
		for(var i in pok)
			row[i] = pok[i];
	}
	catch(e) {
		return cb(e);
	}
	let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
				'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
				'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
				'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
				'spd_iv', 'spe_iv', 'description'];

	let data_arr = [];

	let querystr = 'UPDATE Sets SET ';

	data.forEach(attr => {
		data_arr.push(row[attr]);
		querystr += attr + ' = ?';
		if (attr != 'description')
			querystr += ', ';
	})
	querystr += ' WHERE id = ?';
	data_arr.push(request.params.id);
	c.query(querystr, data_arr, (e, rows) => {
		if (e)
			return cb(e);
		cb(null, rows.info);
	});
})

let deleteSet = p(async (request, cb) => {
	let row = await getSetById(request.params.id);	
	row = row[0];
	if (request.body.trip == '' ||
		(request.body.trip != settings.admin_pass &&
		 row.hash != tripcode(request.body.trip)))
		return cb('Wrong tripcode');
	c.query('DELETE FROM Sets WHERE id = ?', [request.params.id], (e, rows) => {
		if (e)
			return cb(e);
		cb(null, rows.info);
		module.exports.total--;
	});
})

module.exports.getAllSets				= getAllSets;
module.exports.memesInReplay			= memesInReplay;
module.exports.getReplays				= getReplays;
module.exports.getChampFromTrip			= getChampFromTrip;
module.exports.getChamps				= getChamps;
module.exports.createChampFromTrip		= createChampFromTrip;
module.exports.addReplay				= addReplay;
module.exports.getSetsPage				= getSetsPage;
module.exports.addSetToReplay			= addSetToReplay;
module.exports.updateChampAvatar		= updateChampAvatar;
module.exports.registerChampResult		= registerChampResult;
module.exports.getSetById				= getSetById;
module.exports.getSetsByProperty		= getSetsByProperty;
module.exports.getSetsByPropertyExact	= getSetsByPropertyExact;
module.exports.getSetsByName			= getSetsByName;
module.exports.createNewSet				= createNewSet;
module.exports.updateSet				= updateSet;
module.exports.deleteSet				= deleteSet;
module.exports.c                        = c;
