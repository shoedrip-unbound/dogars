let config = (localStorage.config && JSON.parse(localStorage.config)) || { dark: localStorage.dark == 'true' };

delete localStorage.dark;

let reloadTheme = () => {
	colorscheme.href = config.dark ? "/color2.css" : "/color.css";
	waifu.src = config.dark ? '/moon.png': '/lillie2.png';
	document.cookie = "dark=" + config.dark;
	localStorage.config = JSON.stringify(config);
}

let display_message = (msg) => {
	response.style.display = 'inline-table';
	response.textContent = '';
	let inter;
	let addNextChar = () => {
		if (msg == '') {
			return;
		}
		let c = msg.substr(0, 1);
		response.textContent += c;
		msg = msg.substr(1);
		let time = ".,!".indexOf(c) == -1 ? 32 : 250;
		console.log(time);
		inter = setTimeout(addNextChar, time);
	};
	inter = setTimeout(addNextChar, 16);
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
											 headers: {'Content-Type': 'application/x-www-form-urlencoded',
													   'Cookie': document.cookie,
													   'I-want': 'to cum'},
											 body: 'v=' + trip.value });
			let res = await fetch(req);
			let arr = await res.arrayBuffer();
			let str = new TextDecoder().decode(arr);
			let real = tripbox.textContent.substr(0, 10);
			tripbox.textContent = real + ' | ' + str;
		}
	}

	let add = [109, 97, 105, 108, 116, 111, 58, 115, 104, 111, 101, 100, 114, 105, 112, 45, 117, 110, 98, 111, 117, 110, 100, 64, 100, 111, 103, 97, 114, 115, 46, 109, 108];
	let mail = document.getElementById('mail');
	add = add.map(f => String.fromCodePoint(f)).join('');
	mail.setAttribute('href', add);

	msgbox.onkeydown = async e => {
		if (e.key != 'Enter')
			return;
		let message = msgbox.value;
		msgbox.value = '';
		let req = new Request('/lillie', { method: 'POST',
										   headers: {'Content-Type': 'application/x-www-form-urlencoded'},
										   body: 'message=' + encodeURIComponent(message) + '&cook=' + encodeURIComponent(document.cookie) });
		let res = await fetch(req);
		let arr = await res.arrayBuffer();
		let str = new TextDecoder().decode(arr);
		let data = JSON.parse(str);
		console.log(data);
		display_message(data.fulfillment.speech);
		waifu.src = '/lillie2.png';
		if (data.emotion)
			waifu.src = '/lillie-' + data.emotion + '.png';
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

let getChampStats = champ => {
	return {
		wins: ~~champ.children[2].children[0].textContent,
		losses: ~~champ.children[2].children[1].textContent,
		elo: ~~(champ.children[3] ? champ.children[3].children[0].textContent : 0)
	};
}

let sortChamps = function() {
	let champs = document.getElementsByClassName('champs')[0];
	let getData = 'return ' + this.value + ';';
	getData = new Function(getData);
	let arr = [].slice.call(champs.children).sort((a, b) => {
		let adata = getData.call(getChampStats(a));
		let bdata = getData.call(getChampStats(b));
		return bdata - adata;
	}).forEach(e => e.parentNode.appendChild(e))
}
