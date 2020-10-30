require('dotenv').config()

const puppeteer = require("puppeteer");
const mysql = require("mysql");
const keyword_extractor = require("keyword-extractor");

var count = 0;

main();

async function main() {
  require('dotenv').config()
  const tblArr = [];
  const tableName = process.env.DB_SOURCE_TABLE;
  const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB,
})

  connection.connect(async function (err) {
    if (err) {
      console.error("error connecting: " + err.stack);
      return;
    }
    console.log(`Connected to MySQL database with ID ${connection.threadId}`);
    connection.query(`SELECT * FROM ${tableName}`, async function (
      err,
      result,
      fields
    ) {
      result.forEach((element) => {
        tblArr.push({
          id: element.id,
          title: element.tbl_title,
          author: element.tbl_author,
        });
      });
    });
  });

  const browser = await puppeteer.launch({
    headless: true,
  });

  while (count <= tblArr.length) {
    await tblArrPop();
  }

  async function tblArrPop() {
    let focus = 3;
    let element = tblArr.pop();
    await search(element, focus);
  }

  async function search(element, f) {
    let focus = f;
    let query = await getQuery(element.title, element.author, focus);
    let result = [];
    let page = await browser.newPage({});
    let searchURL = `https://celalibrary.ca/bibliographic-search?search_term=${query}&sort_bef_combine=search_api_relevance%20DESC&searchPref=yes&f%5B0%5D=audio_narrator_type%3A15238`;
    await page.goto(searchURL);
    let numResults = await page
      .evaluate(() => {
        let numResults = document
          .querySelector("div.view-header > p")
          .innerText.match(/\d*(?= items)/g)[0];
        return parseInt(numResults);
      })
      .catch(() => {
        return 0;
      });
    for (i = 1; i <= numResults; i++) {
      let url = await page
        .evaluate((i) => {
          let node = document
            .querySelector(
              `div.view-content > div:nth-child(${i}) > div > div.book-title-block--cover-title > div.book-title-block--title-author > h2`
            )
            .innerHTML.match(/(?<=node\/)\d*/g)[0];
          return `https://celalibrary.ca/node/${node}`;
        }, i)
        .catch(() => {
          return ``;
        });
      result.push(url);
    }
    page.close();
    console.log(
      `search: "${decodeURI(
        query
      )}"\nsearchURL: ${searchURL}\nhits: ${numResults}\nresult:`,
      result,
      `\n `
    );
    updateTable(result, element, searchURL);
    if (numResults == 1) {
      return;
    }
    if (numResults > 1) {
      if (focus == 4) return;
      else {
        focus++;
        console.log(`narrowing results...`);
        search(element, focus);
      }
    }
    return;
  }

  function updateTable(result, element, searchurl) {
    let sql = `UPDATE ${tableName} SET hits = ${result.length}, urls = '${
      result.length > 0 ? result[0] : ""
    }', searchurl = ${JSON.stringify(searchurl).replace(/'"'/g, "")} WHERE id=${
      element.id
    }`;
    connection.query(sql, function (err, result) {
      if (err) throw err;
    });
  }

  async function getQuery(title, author, focus) {
    let s1 = title.replace(/((, The$)|(, A$)|(,The$)|(,A$))/g, "");
    if (focus < 4) {
      s1 = keyword_extractor
        .extract(s1, {
          language: "english",
          remove_digits: false,
          return_changed_case: true,
          remove_duplicates: true,
        })
        .slice(0, focus)
        .join(" ");
    }
    let s2 = author.toLowerCase().replace(/,/g, "");
    return encodeURI(`${s1} ${s2}`);
  }
}
