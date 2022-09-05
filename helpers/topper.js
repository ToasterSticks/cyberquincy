const fetch = require('node-fetch');
const url = 'http://topper64.co.uk/nk/btd6/dat/towers.json';
// note: this currently isnt being used

async function getJson() {
    await fetch(url)
        .then((res) => res.json())
        .then((json) => {
            return json;
        });
}

function getHeroObject(name, json, level) {
    let object = json[`${name}`].upgrades[level - 1];
    return object;
}

module.exports = {};
