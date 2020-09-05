import { Champ } from './Shoedrip/Champ';
import { BattleData } from './Showdown/BattleData';
import { BattleURL, CringeCompilation } from './Backend/CringeCompilation';
import { DogarsClient } from './DogarsClient';
import { registerChampResult } from './Backend/mongo';
import { champ } from './Shoedrip/shoedrip';
import { monitor } from './bot-utils';
import { Player } from './Showdown/Player';

export class DogarsLocalClient implements DogarsClient {
    cc: CringeCompilation | undefined;

    constructor(private player: Player) {
    }

    registerChampResult(data: BattleData, won: boolean): Promise<void> {
        return registerChampResult(data, won);
    }

    async monitor() {
        monitor(champ, this.player, this);
    }

    async refresh() {
        return champ;
    }

    async setbattle(url: BattleURL) {
        champ.current_battle = url;
    }

    async snap() {
        await this.cc?.snap()
    }

    async prepareCringe(u: BattleURL) {
        this.cc = new CringeCompilation(u);
        await this.cc?.init();
    }

    async closeCringe() {
        await this.cc?.done();
    }
}
