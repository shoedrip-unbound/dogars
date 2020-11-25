import { settings } from './Backend/settings';
import { monitor } from './bot-utils';
import { Player } from './Showdown/Player';
import { DogarsIPCClient } from './DogarsClient';
export let dogarschan: Player;

(async () => {
    dogarschan = new Player(settings.showdown.user, settings.showdown.pass);
    await dogarschan.connect();
    const remoteclient = new DogarsIPCClient(dogarschan);
    await remoteclient.connect();
    for await (let msg of remoteclient.messageStream()) {
        if (msg.command == 'monitor')
            monitor(msg.champ, dogarschan, remoteclient);
    }
})();
