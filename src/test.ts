import { BattleMonitor } from "./BattleMonitor";
import { Champ } from "./Champ";
import { connection } from "./PSConnection";

(async () => {
    await connection.connect();
    let bdev = new Champ();
    bdev.champ_name = 'bored dev';
    bdev.showdown_name = 'bored dev';
    bdev.champ_trip = 'who cares';
    bdev.champ_battle = 'https://play.pokemonshowdown.com/battle-gen7randombattle-758174346';
    let bm = new BattleMonitor(bdev);
    await bm.monitor();
})();

