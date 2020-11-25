import { settings } from './Backend/settings';
import { monitor } from './bot-utils';
import { Player } from './Showdown/Player';
import { DogarsClient, DogarsIPCClient } from './DogarsClient';
export let dogarschan: Player;
let remoteclient: DogarsIPCClient;

(async () => {
    const 
    remoteclient = new DogarsIPCClient("You don't actually need a password, please no abuse :^)");
    await remoteclient.connect();
    dogarschan = new Player(settings.showdown.user, settings.showdown.pass);
    await dogarschan.connect();
    monitor(await remoteclient.refresh(), dogarschan, remoteclient);
})();
