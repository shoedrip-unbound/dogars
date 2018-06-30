import { MemeStats } from "../Showdown/BattleData";

export class Champ {
	avatar: string = '166';
	champ_battle: string = '';
	champ_name: string = '';
	champ_trip: string = '';
	showdown_name: string = '';
	champ_active: boolean = false;
	deaddrip: boolean = false;
	champ_last_active: number = 0;
	jacked: boolean = false;
	team: MemeStats[] = [];
}