import { toId } from '../Website/utils';
export const Dex: ModdedDex = require('../../pokemon-showdown/.sim-dist/dex').Dex;

export let availableFormats = Object.keys(Dex.formats).map(e => ({
	id: toId(Dex.formats[e].name),
	section: Dex.formats[e].section,
	name: Dex.formats[e].name
}));
