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
	let trip = document.getElementsByName('trip')[0];
	if(trip) {
		trip.onkeyup = async () => {
			let tripbox;

			for (let child of document.getElementsByClassName('info')[0].children)
				if (child.textContent.indexOf('Tripcode') != -1)
					tripbox = child.nextElementSibling;
			if (!tripbox)
				return;
			let req = new Request('/trip', { method: 'POST',
											 headers: {'Content-Type': 'application/x-www-form-urlencoded'},
											 body: 'v=' + trip.value });
			let res = await fetch(req);
			let arr = await res.arrayBuffer();
			let str = new TextDecoder().decode(arr);
			let real = tripbox.textContent.substr(0, 10);
			tripbox.textContent = real + ' | ' + str;
		}
	}
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
