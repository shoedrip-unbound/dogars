import fs = require('fs');
import mustache = require('mustache');
import request = require('request-promise-native');
import pokedexd = require('./pokedex.js');
import { connection } from './PSConnection';
import { SuperSet } from './SuperSet';
import { PSCheckTeamRequest, PSSaveBattleRequest } from './PSMessage';
import { suck, toId, clamp, inverse } from './utils';
import { settings } from './settings';
import { Sets } from './entities/Sets';
import { buildCheckableSet } from './mongo';
let pokedex = pokedexd.BattlePokedex;

// Shamelessly stolen and adapted from showdown-client
let BattleStatIDs: { [idx: string]: string } = {
    HP: 'hp',
    hp: 'hp',
    Atk: 'atk',
    atk: 'atk',
    Def: 'def',
    def: 'def',
    SpA: 'spa',
    SAtk: 'spa',
    SpAtk: 'spa',
    spa: 'spa',
    SpD: 'spd',
    SDef: 'spd',
    SpDef: 'spd',
    spd: 'spd',
    Spe: 'spe',
    Spd: 'spe',
    spe: 'spe'
};

let getTemplate = (name: string) => {
    name = toId(name);
    if (pokedex[name])
        return pokedex[name];
    for (var i in pokedex) {
        // What's the difference between a Form and Forme, Zarel?
        // Why do some Forms have a dex entry while others don't and
        // some Formes have an entry and others don't??? kys
        let formeIdx = pokedex[i].otherFormes ? pokedex[i].otherFormes.indexOf(name) : -1;
        let formIdx = pokedex[i].otherForms ? pokedex[i].otherForms.indexOf(name) : -1;
        if (formeIdx != -1) {
            return pokedex[pokedex[i].otherFormes[formeIdx]] || pokedex[i];
        }
        if (formIdx != -1) {
            return pokedex[pokedex[i].otherForms[formIdx]] || pokedex[i];
        }
    }
};

let getSpecies = (template: any, spec: string) => {
    try {
        if (template.otherForms) {
            let formIdx = template.otherForms.indexOf(spec);
            if (formIdx != -1) {
                let name = template.otherForms[formIdx].slice(template.species.length);
                return toId(template.species) + '-' + name;
            }
        }
        if (template.baseSpecies)
            return toId(template.baseSpecies) + '-' + toId(template.forme);
        return toId(template.species);
    }
    catch (e) {
        console.log(e);
    }
}

export module pokeUtils {
    export let formatSetFromRow = (set: Sets) => {
        let rich: SuperSet = <SuperSet>set;
        let date = new Date(set.date_added!);
        rich.date = date.toLocaleDateString();
        let template = getTemplate(rich.species!);

        if (template) {
            rich.species_ = getSpecies(template, toId(rich.species))!;
        }

        rich.set_form = '';
        if (rich.name)
            rich.set_form += rich.name + ' (' + rich.species + ')';
        else
            rich.set_form += rich.species;
        if (rich.gender != '')
            rich.set_form += ' (' + rich.gender + ')';
        if (rich.item && rich.item != '')
            rich.set_form += ' @ ' + rich.item;
        rich.set_form += '\nAbility: ' + rich.ability + '\n';
        if (rich.level && rich.level != 100)
            rich.set_form += 'Level: ' + rich.level + '\n';
        if (rich.shiny && rich.shiny !== 0) {
            rich.set_form += 'Shiny: Yes\n';
            rich.s = true;
        }

        rich.description_html = mustache.render('{{d}}', { d: rich.description });
        rich.description_html = (rich.description_html + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');

        const exts = ['png', 'jpg', 'gif'];

        exts.map(e => '/sets/' + rich.id + '.' + e)
            .filter(url => fs.existsSync(settings.ressources + '/public' + url))
            .forEach(url => {
                rich.img_url = url;
                rich.cust = true;
            });

        rich.img_url = rich.img_url || mustache.render('https://play.pokemonshowdown.com/sprites/xyani{{#s}}-shiny{{/s}}/{{species_}}.gif', rich);
        if (rich.happiness !== undefined && rich.happiness !== null && rich.happiness! < 255)
            rich.set_form += 'Happiness: ' + rich.happiness + '\n';
        let stats = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
        let evstr = '';
        let ivstr = '';
        for (var i in stats) {
            let st = stats[i].toLowerCase();
            if (rich[st + '_ev'] != 0) {
                if (evstr.length > 0)
                    evstr += ' / ';
                evstr += rich[st + '_ev'] + ' ' + stats[i];
            }
            if (rich[st + '_iv'] != 31) {
                if (ivstr.length > 0)
                    ivstr += ' / ';
                ivstr += rich[st + '_iv'] + ' ' + stats[i];
            }
        }
        if (evstr != '')
            rich.set_form += 'EVs: ' + evstr + '\n';
        let neutral = ['Serious', 'Bashful', 'Docile', 'Hardy', 'Quirky'];
        let nature = neutral.some(n => n == rich.nature);
        if (rich.nature && !nature)
            rich.set_form += rich.nature + ' Nature\n';
        if (ivstr != '')
            rich.set_form += 'IVs: ' + ivstr + '\n';
        rich.set_form += [1, 2, 3, 4]
            .map(d => 'move_' + d)
            .filter(n => rich[n])
            .map(n => '- ' + rich[n])
            .join('\n');
        return rich;
    }

    export let parseSet = (text: string) => {
        let stext = text.split("\n");
        var team = [];
        var curSet = new SuperSet();
        let moves = [];
        let first = false;
        for (var i = 0; i < stext.length; i++) {
            var line = stext[i].trim();
            if (!first) {
                first = true;
                curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
                curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

                team.push(curSet);
                var atIndex = line.lastIndexOf(' @ ');
                if (atIndex !== -1) {
                    curSet.item = line.substr(atIndex + 3);
                    line = line.substr(0, atIndex);
                }
                if (line.substr(line.length - 4) === ' (M)') {
                    curSet.gender = 'M';
                    line = line.substr(0, line.length - 4);
                }
                if (line.substr(line.length - 4) === ' (F)') {
                    curSet.gender = 'F';
                    line = line.substr(0, line.length - 4);
                }
                var parenIndex = line.lastIndexOf(' (');
                if (line.substr(line.length - 1) === ')' && parenIndex !== -1) {
                    line = line.substr(0, line.length - 1);
                    curSet.species = line.substr(parenIndex + 2);
                    line = line.substr(0, parenIndex);
                    curSet.name = line;
                } else {
                    curSet.species = line.trim();
                    curSet.name = '';
                }
            } else if (line.substr(0, 9) === 'Ability: ') {
                line = line.substr(9);
                curSet.ability = line.substr(0, 20);
            } else if (line === 'Shiny: Yes') {
                curSet.shiny = 1;
            } else if (line.substr(0, 7) === 'Level: ') {
                line = line.substr(7);
                curSet.level = clamp(1, +line, 100);
            } else if (line.substr(0, 11) === 'Happiness: ') {
                line = line.substr(11);
                curSet.happiness = clamp(0, +line, 256);
            } else if (line.substr(0, 5) === 'EVs: ') {
                line = line.substr(5);
                var evLines = line.split('/');

                curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

                for (var j = 0; j < evLines.length; j++) {
                    var evLine = evLines[j].trim();
                    var spaceIndex = evLine.indexOf(' ');
                    if (spaceIndex === -1) continue;
                    var statid = BattleStatIDs[evLine.substr(spaceIndex + 1)];
                    var statval = parseInt(evLine.substr(0, spaceIndex), 10);
                    if (!statid) continue;
                    curSet[statid + '_ev'] = clamp(0, statval, 252);
                }
            } else if (line.substr(0, 5) === 'IVs: ') {
                line = line.substr(5);
                var ivLines = line.split(' / ');
                curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
                for (var j = 0; j < ivLines.length; j++) {
                    var ivLine = ivLines[j];
                    var spaceIndex = ivLine.indexOf(' ');
                    if (spaceIndex === -1) continue;
                    var statid = BattleStatIDs[ivLine.substr(spaceIndex + 1)];
                    var statval = parseInt(ivLine.substr(0, spaceIndex), 10);
                    if (!statid) continue;
                    if (isNaN(statval)) statval = 31;
                    curSet[statid + '_iv'] = clamp(0, statval, 31);
                }
            } else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
                var natureIndex = line.indexOf(' Nature');
                if (natureIndex === -1) natureIndex = line.indexOf(' nature');
                if (natureIndex === -1) continue;
                line = line.substr(0, natureIndex);
                if (line !== 'undefined') curSet.nature = line.substr(0, 15);
            } else if (line.substr(0, 1) === '-' || line.substr(0, 1) === '~') {
                line = line.substr(1);
                if (line.substr(0, 1) === ' ') line = line.substr(1);
                moves.push(line);
            }
        }
        curSet.move_1 = moves[0];
        curSet.move_2 = moves[1];
        curSet.move_3 = moves[2];
        curSet.move_4 = moves[3];
        curSet.name = curSet.name!.substr(0, 30);
        curSet.species = curSet.species!.substr(0, 30);
        return curSet;
    }

    let headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'dnt': '1',
        'origin': 'https://play.pokemonshowdown.com',
        'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
    }

    let replayq = 'a["|queryresponse|savereplay|';

    let pack = (set: Sets): string => {
        let packed = (set.name || '') + '|';
        let attrs1 = ['species', 'item', 'ability'];
        packed += attrs1.map(attr => toId(set[attr]) + '|').join('');
        packed += [1, 2, 3, 4]
            .map(d => 'move_' + d)
            .map(m => toId(set[m]))
            .join(',') + '|';
        packed += (set.nature || '') + '|';
        packed += ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
            .map(s => s + '_ev')
            .map(s => set[s] == 0 ? '' : set[s])
            .join(',') + '|';
        packed += (set.gender || '') + '|';
        packed += ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
            .map(s => s + '_iv')
            .map(s => set[s] == 31 ? '' : set[s])
            .join(',') + '|';
        if (set.shiny)
            packed += 'S';
        packed += '|' + ((set.level && set.level != 100) ? set.level : '') + '|';
        packed += ((set.happiness && set.happiness < 255) ? set.happiness : '');
        return packed;
    }

    export let checkSet = async (set: Sets) => {
        let cset = buildCheckableSet(set);
        await connection.setTeam(pack(cset));
        let req = new PSCheckTeamRequest(set.format!);
        let res = await connection.request(req);
        if (res.failed)
            return res.reasons;
        return null;
    }

    export let saveReplay = async (url: string) => {
        let room = url.match(/(battle-.*)\/?/)![0];
        let roomid = url.match(/battle-(.*)\/?/)![1];

        connection.tryJoin(room);
        let req = new PSSaveBattleRequest(room);
        let data = await connection.request(req);
        try {
            await request.post('http://play.pokemonshowdown.com/~~showdown/action.php?act=uploadreplay', {
                headers: headers,
                form: data
            });
        } catch (e) {
            console.log("Couldn't save replay:", data, e);
        }
    }
}
