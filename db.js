/* global require console */

var c        = require('mysql-promise')();
let fs       = require('fs');
let poke     = require('./poke-utils');
let request  = require('request-promise-native');
let tripcode = require('tripcode');
let settings = JSON.parse(fs.readFileSync('settings.json'));
let logger	 = require('./logger');

c.configure(settings.db);

let total = 0;

c.query('select count(*) from Sets').then(rows => {
	total = rows[0]['count(*)'];
	total = parseInt(total);
	logger.log(0, total, "sets in database");
	module.exports.total = total;
});

let getAllSets			= async	()							=> await c.query('select * from Sets');
let memesInReplay		= async rid							=> await c.query('select * from memes.Sets where id in (select idset from memes.sets_in_replays where idreplay = ?)', [rid]);
let getReplays			= async manual						=> await c.query('select * from replays where manual = ? order by id desc;', [manual]);
let getReplaysSets		= async manual						=> await c.query('select * from replays inner join sets_in_replays on replays.id = sets_in_replays.idreplay inner join Sets on idset = Sets.id where manual = ? order by replays.id desc', [manual]);
let getChampFromTrip	= async trip						=> await c.query('select * from memes.champs where trip = ? order by id desc;', [trip]);
let getChamps			= async ()							=> await c.query('select * from memes.champs order by wins desc;');
let createChampFromTrip = async (name, trip)				=> await c.query('insert into memes.champs (name, trip) values (?, ?) ', [name || '', trip]);
let addReplay			= async data						=> await c.query('insert into memes.replays (link, description, champ, trip, manual) values (?, ?, ?, ?, ?);', [data.link, data.description, data.champ || '', data.trip || '', data.manual || false]);
let getSetsPage			= async (setPerPage, pageNumber)	=> await c.query('select * from Sets order by id desc limit ? offset ?;', [~~setPerPage, ~~(setPerPage * pageNumber)]);
let addSetToReplay		= async (setid, rid)				=> await c.query('insert into memes.sets_in_replays (idreplay, idset) values (?, ?)', [rid, setid]);
let updateChampAvatar	= async (trip, aid)					=> await c.query('update memes.champs set avatar = ? where trip = ?', [aid, trip]);
let getSetById			= async id							=> await c.query('select * from Sets where id = ?', [id]);
let getSetByNo			= async no							=> await c.query('select * from Sets limit 1 offset ?', [no]);
let getRandomSet		= async ()							=> await c.query('select * from Sets as r1 join (select ceil(rand() * (select max(id) from Sets)) as id) as r2 where r1.id >= r2.id limit 1');
let updateChampName		= async (trip, aid)					=> await c.query('update memes.champs set name = ? where trip = ?', [aid, trip]);

let toId = text => {
	// this is a duplicate of Dex.getId, for performance reasons
	if (text && text.id) {
		text = text.id;
	} else if (text && text.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '';
	return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

let registerChampResult = async (battleData, hasWon) => {
	let replayurl;
	try {
		logger.log(0, `Checking elo of ${toId(battleData.champ.showdown_name)}`);
		let b = await request.get(`https://play.pokemonshowdown.com/~~showdown/action.php?act=ladderget&user=${toId(battleData.champ.showdown_name)}`);
		b = JSON.parse(b.substr(1));
		if (b.length == 0)
			throw "Unregistered or never played";
		b = b.filter(e => e.formatid == 'gen7ou')[0];
		if (!b)
			throw "Never played OU";
		b = ~~b.elo;
		logger.log(0, `${battleData.champ.showdown_name} has a elo of ${b}`);
		// no need to sync
		c.query('update memes.champs set elo = ? where trip = ?', [b, battleData.champ.champ_trip]);
		// might be useful to store this
		c.query('update memes.champs set showdown_name = ? where trip = ?', [battleData.champ.showdown_name, battleData.champ.champ_trip]);
	} catch(e) {
		console.log(e);
	}
	if (hasWon) {
		logger.log(0, `${battleData.champ.showdown_name} won`);
		await poke.saveReplay(battleData.champ.champ_battle);
		replayurl = 'http://replay.pokemonshowdown.com/' + battleData.roomid;
	} else {
		logger.log(0, `${battleData.champ.showdown_name} lost`);
	}

	let inc = hasWon ? 'wins' : 'loses';
	let champ = await getChampFromTrip(battleData.champ.champ_trip);
	if (champ.length == 0) {
		logger.log(0, `This was ${battleData.champ.champ_name} first battle`);
		await createChampFromTrip(battleData.champ.champ_name, battleData.champ.champ_trip);
	}

	await c.query('update memes.champs set ' + inc + ' = ' + inc + ' + 1 where trip = ?', [battleData.champ.champ_trip]);
	if (battleData.champ.avatar)
		updateChampAvatar(battleData.champ.champ_trip, battleData.champ.avatar.substr(battleData.champ.avatar[0] == '#'));
	updateChampName(battleData.champ.champ_trip, battleData.champ.champ_name);
	if (!hasWon)
		return;
	logger.log(0, `Adding ${battleData.champ.champ_name} battle to database`);
	let info = await addReplay({
		link: replayurl,
		description: 'Automatically uploaded replay. Champ: ' + battleData.champ.champ_name + ' ' + battleData.champ.champ_trip,
		champ: battleData.champ.champ_name,
		trip: battleData.champ.champ_trip
	});
	logger.log(0, `Replay successfully added ${info}`);
	logger.log(0, `${battleData.memes.length} memes detected in champs team`);
	let n = 0;
	for(let i = 0; i < battleData.memes.length; ++i) {
		let sets = await getSetsByPropertyExact({name: battleData.memes[i].name});
		if (sets.length >= 1) {
			sets = sets[0];
			++n;
			addSetToReplay(sets.id, info.insertId);
		}
	}
	logger.log(0, `${n} memes matched in db`);
}

let getSetsByProperty = async props => {
	let querystr = 'select * from Sets ';
	let data = [];
	let where_clause = Object.keys(props).map(i => '?? like ?').join(' and ');
	Object.keys(props).forEach(i => data.push(i, '%' + props[i] + '%'));
	if (where_clause)
		querystr += 'where ' + where_clause;
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
	let formats = ["gen7ou", "gen7ubers", "gen7anythinggoes", "gen7uu", "gen7ru", "gen7nu", "gen7pu", "gen7lc", "gen7natureswap", "gen7balancedhackmons", "gen7mixandmega", "gen7almostanyability", "gen7camomons", "gen7stabmons", "gen7customgame"];
	if (formats.includes(request.body.format))
		row.format = request.body.format;
	row.creator = request.body.creat.substr(0, 23);
	row.description = request.body.desc.substr(0, 230);
	row.date_added = +new Date();
	let pok = poke.parseSet(request.body.set);
	pok.format = row.format;
	let errors = await poke.checkSet(pok);
	if (errors)
		throw errors;
	for(let i in pok)
		row[i] = pok[i];
	let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
				'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
				...[1, 2, 3, 4].map(id => `move_${id}`),
				/// who else /high-iq/ here?
				...['e', 'i'].map(t => ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(s => `${s}_${t}v`)).reduce((a, b) => a.concat(b), []),
				'description'];
	let data_arr = [];
	let querystr = `insert into Sets (${data.map(attr => '??').join(', ')}) value (${data.map(attr => '?').join(', ')})`;
	data_arr.push(...data, ...data.map(attr => row[attr]));
	let rows = await c.query(querystr, data_arr);
	module.exports.total++;
	return rows;
}

let buildCheckableSet = set => {
	let nset = set;
	[1, 2, 3, 4]
		.map(d => 'move_' + d)
		.forEach(mp => nset[mp] = nset[mp] ? nset[mp].split('/')[0].trim() : null);
	return nset;
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

	let querystr = `update Sets set ${data.map(attr => '?? = ?').join(', ')} WHERE id = ?`;

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
	let rows = await c.query('delete from Sets where id = ?', [request.params.id]);
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
module.exports.getReplaysSets			= getReplaysSets;
module.exports.getRandomSet				= getRandomSet;