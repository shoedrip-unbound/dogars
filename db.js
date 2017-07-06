/* global require console */

var c        = require('mysql-promise')();
let fs       = require('fs');
let poke     = require('./poke-utils');
let tripcode = require('tripcode');
let settings = JSON.parse(fs.readFileSync('settings.json'));
let p        = require('util').promisify;

c.configure(settings.db);

let total = 0;

c.query('SELECT COUNT(*) FROM Sets').then(rows => {
	total = rows[0]['COUNT(*)'];
	total = parseInt(total);
	module.exports.total = total;
});

let getAllSets			= async	()							=> await c.query('select * from Sets');
let memesInReplay		= async rid							=> await c.query('select * from memes.Sets where id in (select idset from memes.sets_in_replays where idreplay = ?)', [rid]);
let getReplays			= async manual						=> await c.query('select * from replays where manual = ? order by id desc;', [manual]);
let getChampFromTrip	= async trip						=> await c.query('select * from memes.champs where trip = ? order by id desc;', [trip]);
let getChamps			= async ()							=> await c.query('select * from memes.champs order by wins desc;');
let createChampFromTrip = async (name, trip)				=> await c.query('insert into memes.champs (name, trip) values (?, ?) ', [name || '', trip]);
let addReplay			= async data						=> await c.query('insert into replays (link, description, champ, trip, manual) values (?, ?, ?, ?, ?);', [data.link, data.description, data.champ || '', data.trip || '', data.manual || false]);
let getSetsPage			= async (setPerPage, pageNumber)	=> await c.query('select * from Sets order by id desc limit ? offset ?;', [~~setPerPage, ~~(setPerPage * pageNumber)]);
let addSetToReplay		= async (setid, rid)				=> await c.query('insert into memes.sets_in_replays (idreplay, idset) values (?, ?)', [rid, setid]);
let updateChampAvatar	= async (trip, aid)					=> await c.query('update memes.champs set avatar = ? where trip = ?', [aid, trip]);
let getSetById			= async id							=> await c.query('select * from Sets where id = ?', [id]);
let getSetByNo			= async no							=> await c.query('select * from Sets limit 1 offset ?', [no]);

let registerChampResult = async (battleData, hasWon) => {
	let replayurl;

	if (hasWon) {
		poke.saveReplay(battleData.champ.champ_battle, () => {
			console.log('replay saved (' + battleData.champ.champ_battle + ')');
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
		description: 'Automatically uploaded replay. Champ: ' + battleData.champ.champ_name + ' ' + battleData.champ.champ_trip,
		champ: battleData.champ.champ_name,
		trip: battleData.champ.champ_trip
	});

	for(var i = 0; i < battleData.memes.length; ++i) {
		let sets = await getSetsByPropertyExact({name: battleData.memes[i].name});
		if (sets.length >= 1) {
			sets = sets[0];
			addSetToReplay(sets.id, info.insertId);
		}
	}
}

let getSetsByProperty = async props => {
	let querystr = 'select * from Sets where ';
	let data = [];
	querystr += Object.keys(props).map(i => '?? like ?').join(' and ');
	Object.keys(props).forEach(i => data.push(i, '%' + props[i] + '%'));
	return await c.query(querystr, data);
}

let getSetsByPropertyExact = async props => {
	let querystr = 'select * from Sets where ';
	let data = [];
	querystr += Object.keys(props).map(i => '?? like ?').join(' and ');
	Object.keys(props).forEach(i => data.push(i, props[i]));
	return await c.query(querystr, data);
}

let getSetsByName = async name => {
	let pattern = '%' + name + '%';
	let sets = await c.query('select * from Sets where name like ? or species like ? or move_1 like ? or move_2 like ? or move_3 like ? or move_4 like ?',
							 [pattern,
							  pattern, pattern, pattern, pattern,
							  pattern]);
	return sets;
}

let createNewSet = async (request) => {
	let row = {};
	row.hash = tripcode(request.body.trip);
	row.format = "gen7ou";
	let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
				   "nu", "pu", "lc", "cap"];
	if (formats.includes(request.body.format))
		row.format = request.body.format;
	row.creator = request.body.creat.substr(0, 23);
	row.description = request.body.desc.substr(0, 230);
	row.date_added = +new Date();

	let pok = poke.parseSet(request.body.set);
	for(var i in pok)
		row[i] = pok[i];
	let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
				'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
				'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
				'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
				'spd_iv', 'spe_iv', 'description'];
	let data_arr = [];
	let querystr =
		'INSERT INTO Sets (' + data.map(attr => '??').join(', ')	
		+ ') VALUES (' + data.map(attr => '?').join(', ') + ')';

	data_arr.push(...data, ...data.map(attr => row[attr]));

	let rows = await c.query(querystr, data_arr);
	module.exports.total++;
	let set = await getSetById(rows.insertId);
	set = poke.formatSetFromRow(set[0]);
	let errors = await poke.checkSet(set);
	if (errors) {
		deleteSet({params: {id: set.id},
				   body: {trip: settings.admin_pass}});
		throw errors;
	} else {
		return rows;
	}
}

let updateSet = async (request) => {
	let row = await getSetById(request.params.id);
	row = row[0];
	if (request.body.trip == '' || (request.body.trip != settings.admin_pass && row.hash != tripcode(request.body.trip)))
		throw 'Wrong tripcode';
	
	row.format = "gen7ou";
	let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
				   "nu", "pu", "lc", "cap"];
	if (formats.includes(request.body.format))
		row.format = request.body.format;
	row.description = request.body.desc.substr(0, 230);
	row.date_added = +new Date();
	
	try {
		let pok = poke.parseSet(request.body.set);
		for(var i in pok)
			row[i] = pok[i];
		let set = poke.formatSetFromRow(row);
		let errors = await poke.checkSet(set);
		if (errors) {
			throw errors;
		}
	}
	catch(e) {
		throw e;
	}
	
	let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
				'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
				'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
				'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
				'spd_iv', 'spe_iv', 'description'];
	
	let data_arr = [];
	
	let querystr = 'UPDATE Sets SET ';
	
	querystr += data.map(attr => '?? = ?').join(', ');
	querystr += ' WHERE id = ?';
	
	data.map(attr => data_arr.push(attr, row[attr]));
	data_arr.push(request.params.id);
	let rows = await c.query(querystr, data_arr);
	return rows.info;
}

let deleteSet = async request => {
	let row = await getSetById(request.params.id);	
	row = row[0];
	if (request.body.trip == '' ||
		(request.body.trip != settings.admin_pass &&
		 row.hash != tripcode(request.body.trip)))
		throw 'Wrong tripcode';
	let rows = await c.query('DELETE FROM Sets WHERE id = ?', [request.params.id]);
	module.exports.total--;
	return rows.info;
}

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
module.exports.getSetByNo				= getSetByNo;
module.exports.getSetsByProperty		= getSetsByProperty;
module.exports.getSetsByPropertyExact	= getSetsByPropertyExact;
module.exports.getSetsByName			= getSetsByName;
module.exports.createNewSet				= createNewSet;
module.exports.updateSet				= updateSet;
module.exports.deleteSet				= deleteSet;
module.exports.c                        = c;
