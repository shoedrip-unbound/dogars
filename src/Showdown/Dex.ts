import { toId } from '../Website/utils';
export const Dex: ModdedDex = require('../../pokemon-showdown/.sim-dist/dex').Dex;

export let availableFormats = Dex.formats.all().map(e => ({
	id: toId(e.name),
	section: e.section,
	name: e.name
}));
