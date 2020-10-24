import * as puppeteer from "puppeteer-core";
import fs = require('fs');
import { settings } from "./settings";
import { Cringer } from "./CringeProvider";
import { As } from "../Showdown/PSMessage";

export type BattleURL = string & As<'BattleURL'>;

let browser: puppeteer.Browser | null = null;
let getBrowser = async () => {
    if (browser)
        return browser;
    return browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
}

let page: puppeteer.Page | null = null;
let getPage = async () => {
    if (page)
        return page;
    if (!browser)
        browser = await getBrowser();
    return page = await browser.newPage();
}

export class CringeCompilation {
    battleLink: BattleURL;
    inited: boolean = false;
    page?: puppeteer.Page;
    constructor(battleLink: BattleURL) {
        this.battleLink = battleLink;
    }

    async init() {
        this.page = await getPage();
        this.page.setViewport({ width: 831, height: 531 });

        await this.page.goto(this.battleLink);
        let lll: any = {
            "dark": false,
            "bwgfx": false,
            "noanim": false,
            "nopastgens": true
        };
        lll = JSON.stringify(lll);
        try {
            await this.page.evaluate(`localStorage.setItem("showdown_prefs", '${lll}');`);
        } catch(e) {
            console.error(e);
        }
        this.inited = true;
    }

    async snap() {
        if (!this.inited)
            await this.init();
        let buff = await this.page!.screenshot({
            type: 'png'
        });
        let cringefolder = `${settings.ressources}/public/cringec`;
        if (!fs.existsSync(cringefolder))
            fs.mkdirSync(cringefolder);
        let tmp = `${cringefolder}/tmp.png`;
        fs.writeFileSync(tmp, buff);
        let len = fs.readdirSync(cringefolder).length;
        let newfile = `${cringefolder}/${len}.png`
        fs.renameSync(tmp, newfile);
        Cringer.pushNewCringe(len);
    }

    done() {
        // Don't actually close because we don't want to open/close tabs everytime,
        // simply reuse the currently opened tab
        //return this.page!.close({runBeforeUnload: false});
    }
}
