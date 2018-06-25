let client = new SockJS('/cringep');
let ncringes = 0;

client.onmessage = ev => {
    let n = JSON.parse(ev.data);
    let container = document.getElementById('#cringe');
    let create = document.createElement.bind(document);
    while (ncringes != n) {
        let url = `/cringec/${ncringes + 1}.png`;
        let img = create('img');
        img.setAttribute('class', 'cringe-image');
        img.setAttribute('src', url);
        let link = create('a');
        link.setAttribute('href', url);
        link.appendChild(img);
        container.insertBefore(link, container.firstChild);
        ncringes++;
    }
};

