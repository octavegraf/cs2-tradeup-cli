import fs from 'fs';
import jsdom from 'jsdom';
import followRedirects from 'follow-redirects';
const { http, https } = followRedirects;
import { getArgsVal } from './cmd.js';
import Skin from './models/skin.js';
import Source from './models/source.js';
import { getArgs } from './utils/args.js';
import { getHighestRarity, rarityToNumber } from './utils/rarity.js';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const scrapeWithSelenium = async (url) => {
    let options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--disable-gpu');
    options.addArguments('--no-sandbox');
    options.addArguments('window-size=1920,1080');  // Assure-toi que cette ligne est présente.

    let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    try {
        await driver.get(url);
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        let pageContent = await driver.getPageSource();
        return pageContent;
    } finally {
        await driver.quit();
    }
};

async function getGunsSources() {
    let driver = await new Builder().forBrowser("chrome").build();
    let res = [];

    try {
        // Charger la page
        await driver.get("https://stash.clash.gg");

        // Attendre que l'élément soit présent (max 10s)
        let navTabs = await driver.findElements(By.className("desktop-nav-tabs"));

        console.log("NavTabs trouvés:", navTabs.length);

        if (navTabs.length > 0) {
            let all = await navTabs[0].findElements(By.xpath("./*")); // Récupérer les enfants

            for (let i = 0; i < all.length; i++) {
                if (i !== 6 && i !== 7) continue; // Filtrer les menus inutiles
                
                let menuChildren = await all[i].findElements(By.xpath("./*[2]/*")); // Deuxième enfant contient les items
                
                for (let e of menuChildren) {
                    let subChildren = await e.findElements(By.xpath("./*"));
                    if (subChildren.length > 0) {
                        let temp = { url: "", source: "" };
                        temp.url = await subChildren[0].getAttribute("href");
                        temp.source = (await subChildren[0].getText()).trim();

                        if (["All Skin Cases", "Souvenir Packages", "Gift Packages"].includes(temp.source)) continue;

                        res.push(temp);
                    }
                }
            }
        } else {
            console.log("Element 'desktop-nav-tabs' introuvable. Skipping...");
        }

    } catch (err) {
        console.error("Erreur lors du scraping:", err);
    } finally {
        await driver.quit(); // Fermer le navigateur
    }

    return res;
}

// Test de la fonction
getGunsSources().then(data => console.log("Résultat :", data));

const scrapeUrl = (url) => {
    return new Promise((resolve, reject) => {
        let client = url.startsWith("https") ? https : http;
        client.get(url, (resp) => {
            let data = '';
            resp.on('data', (chunk) => { data += chunk; });
            resp.on('end', () => { resolve(data); });
        }).on("error", (err) => { reject(err); });
    });
};

async function getGunsData(){
    let gunSources = await getGunsSources();
    let gunsData = {};
    for(let i = 0; i < gunSources.length; i++){
        console.log(`now scraping: ${gunSources[i].source}`);
        gunsData[`${gunSources[i].source}`] = await gunScrape(gunSources[i].url);
    }
    return gunsData;
}

async function gunScrape(url){
    let res = [];
    let scraped = await scrapeWithSelenium(url);
    let dom = new jsdom.JSDOM(scraped);
    let boxes = [...dom.window.document.getElementsByClassName('result-box')];
    let allRarities = [...dom.window.document.getElementsByClassName('quality')];
    const highestRarity = rarityToNumber(getHighestRarity(allRarities));

    for (let p of boxes) {
        if(p.textContent.includes("Rare") || p.children.length <= 3) continue;
        let gunData = {
            name: p.children[0].textContent,
            rarity: p.children[1].textContent.trim().split(' ')[0],
            imgSrc: p.children[3].children[0].src,
            isValidInput: true,
        };
        if(gunData.rarity == "Contraband") continue;
        let otherData = await advancedGunScrape(p.children[4].children[0].children[0].href);
        gunData = {...gunData, ...otherData};
        res.push(gunData);
    }
    return res;
}

async function advancedGunScrape(url){
    let scraped = await scrapeWithSelenium(url);
    let dom = new jsdom.JSDOM(scraped);
    let gunData = {};
    return gunData;
}

async function updateDatabase(){
    let scrapedData = await getGunsData();
    console.log("[#] scraping data finished!");
    fs.writeFileSync(`data_${Date.now()}.json`, JSON.stringify(scrapedData));
    console.log("[#] scraped data saved to a file!");
}

export { advancedGunScrape, scrapeUrl, updateDatabase };