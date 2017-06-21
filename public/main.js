let config = (localStorage.config && JSON.parse(localStorage.config)) || { dark: localStorage.dark == 'true' };

delete localStorage.dark;

let reloadTheme = () => {
	colorscheme.href = config.dark ? "/color2.css" : "/color.css";
	waifu.src = config.dark ? '/moon.png': '/lillie2.png';
	document.cookie = "dark=" + config.dark;
	localStorage.config = JSON.stringify(config);
}

window.onload = () => {
	let sets = document.getElementsByClassName('set');
	let i;
	for(let set of sets)
		set.onfocus = () => set.select()
	let images = document.getElementsByClassName('set-image');
	for(let image of images)
		image.ondblclick = () => {
			window.location = '/suggest/' + image.dataset.id;
		}
	reloadTheme();
}

waifu.onclick = (e) => {
	config.dark = !config.dark;
	reloadTheme();
	// thenk u 4 stremlinin dis feature
	let toplay = config.dark ? moon : lillie;
	toplay.volume = 0.7;
	toplay.play();
}

ban.ondblclick = () => {
	window.location = '/suggest/banner';
}

let unzip = (elem) => {
	elem.nextElementSibling.style.display = elem.nextElementSibling.style.display == 'block' ? 'none' : 'block';
}
