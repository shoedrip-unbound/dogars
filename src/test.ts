import { createServer } from "http";

import { Champ } from "./Shoedrip/Champ";

import { BattleMonitor } from "./Showdown/BattleMonitor";
import { connection } from "./Showdown/PSConnection";

import { Cringer } from "./Backend/CringeProvider";

let tests = createServer((r, re) => {});
Cringer.install(tests);
tests.listen(1531, async () => {
    await connection.connect();
    let bdev = new Champ();
    bdev.champ_name = 'bored dev';
    bdev.showdown_name = 'bored dev';
    bdev.champ_trip = 'who cares';
    bdev.champ_battle = 'https://play.pokemonshowdown.com/battle-gen7randombattle-767096654';
    let bm = new BattleMonitor(bdev);
    await bm.monitor();
});
