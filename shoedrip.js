const request = require('request-promise-native');

module.exports.champ = {};

let getCurrentThread = async () => {
  let b = await request.get('http://a.4cdn.org/vp/catalog.json');
  let catalog = JSON.parse(b);
  let derp_no = 0;
  catalog.forEach(page => {
    page.threads.forEach(t => {
      if (t.sub && t.sub.toLowerCase().indexOf('showderp') != -1 && t.no > derp_no)
        derp_no = t.no;
    });
  });
  return derp_no;
}

let getCurrentChamp = async b => {
  let thread = JSON.parse(b);
  let derp_no = 0;
  for (var i = thread.posts.length - 1; i != 0; --i) {
    if (thread.posts[i].trip) {
      let content = thread.posts[i].com.replace(/<(?:.|\n)*?>/gm, '');
      let matches;
      if ((matches = content.match(/(http:\/\/)?play.pokemonshowdown.com\/battle-(.*)-([0-9]*)/g))) {
        let champ = {champ_name: thread.posts[i].name, champ_trip: thread.posts[i].trip, champ_last_active: thread.posts[i].time};
        let curtime = ~~(+new Date() / 1000);
        champ.champ_active = curtime - champ.champ_last_active < 15 * 60;
        champ.champ_battle = matches[0];
        if(champ.champ_battle[0] != 'h')
          champ.champ_battle = 'http://' + champ.champ_battle;
        return champ;
      }
    }
  }
  return {};
}

let main = async () => {
  let thread = await getCurrentThread();
  let threadjs = await request.get('http://a.4cdn.org/vp/thread/' + thread + '.json');
  let champ = getCurrentChamp(threadjs);
  module.exports.champ = await champ;
}

main();

setInterval(async () => {await main();}, 1000 * 60);
