import { Player } from './Showdown/Player';
import { BattleMonitor } from './Showdown/BattleMonitor';
import InfoAggregator from './Showdown/BattleHandlers/InfoAggregator';
import Announcer from './Showdown/BattleHandlers/Announcer';
import CringeHandler from './Showdown/BattleHandlers/CringeHandler';
import DigitsChecker from './Showdown/BattleHandlers/DigitsChecker';
import GreetingHandler from './Showdown/BattleHandlers/GreetingHandler';
import HijackHandler from './Showdown/BattleHandlers/HijackHandler';
import EndHandler from './Showdown/BattleHandlers/EndHandler';
import { Champ } from './Shoedrip/Champ';
import type { DogarsClient } from './DogarsClient';

export let monitor = (champ: Champ, account: Player, client: DogarsClient) => {
    console.log(champ);
    console.log('Start monitor')
    if (!champ.active)
        return;
    let bm = new BattleMonitor(account, champ.current_battle!, client);
    let ia = new InfoAggregator(champ);
    bm.attachListeners([
        new Announcer(ia),
//        new CringeHandler,
        new DigitsChecker,
        new GreetingHandler,
        ia,
        //new HijackHandler(ia),
        new EndHandler(ia)
    ]);
    bm.monitor();
}
