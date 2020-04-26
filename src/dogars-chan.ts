import { Player } from './Showdown/Player';
import { BattleMonitor } from './Showdown/BattleMonitor';
import InfoAggregator from './Showdown/BattleHandlers/InfoAggregator';
import Announcer from './Showdown/BattleHandlers/Announcer';
import CringeHandler from './Showdown/BattleHandlers/CringeHandler';
import DigitsChecker from './Showdown/BattleHandlers/DigitsChecker';
import GreetingHandler from './Showdown/BattleHandlers/GreetingHandler';
import HijackHandler from './Showdown/BattleHandlers/HijackHandler';
import EndHandler from './Showdown/BattleHandlers/EndHandler';
import { DogarsClient, IPCCmd } from './DogarsClient';
import { Champ } from './Shoedrip/Champ';
import { monitor } from './bot-utils';
import { BattleURL } from './Backend/CringeCompilation';

console.log('Starting dogars-chan...');

(async () => {
    await DogarsClient.connect();
    console.log('Client Connected too!')

    let ransuff = (n: number) => [...new Array(n)].map(e => '' + ~~(Math.random() * 10)).join('');
    let dogarschan = new Player('dogars-chan' + ransuff(3));
    await dogarschan.connect();
    console.log('Connected too!')
    monitor(await DogarsClient.refresh(), dogarschan);
    for await (let cmd of DogarsClient.messageStream()) {
        console.log(cmd);
        if (cmd.command == 'monitor') {
            monitor(cmd.champ, dogarschan);
        }
    }
})();