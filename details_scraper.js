require('dotenv').config()

const puppeteer = require("puppeteer")
const mysql = require("mysql")
const SqlString = require('sqlstring');

const tblArr = []
const sourceTable = process.env.DB_SOURCE_TABLE
const productionTable = process.env.DB_RESULT_TABLE
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB,
})

main()

async function main() {
    connection.connect(async function (err) {
        if (err) {
            console.error("error connecting: " + err.stack)
            return
        }
        console.log(`Connected to MySQL database with ID ${connection.threadId}`)
        connection.query(`SELECT * FROM ${sourceTable}`, async function (
            err,
            result,
            fields
        ) {
            result.forEach((element) => {
                tblArr.push({
                    id: element.id,
                    tbl_title: element.tbl_title.replace(/((, The$)|(, A$)|(,The$)|(,A$))/g, ""),
                    tbl_author: element.tbl_author,
                    hits: element.hits,
                    urls: element.urls.split(/,\s/),
                })
            })
        })
    })

    const browser = await puppeteer.launch({
        headless: true,
    })

    for(i = 0; i<= tblArr.length; i++){
        await scrapeDetails(tblArr[i])
    }

    async function scrapeDetails(element) {
        let hits = element.hits
        if (hits == 0) {
            console.log(`[scrapeDetails—${element.id}] this element has no urls to scrape :(`)
            return
        }
        else if (hits > 1) {
            console.log(`[scrapeDetails—${element.id}] this element has multiple urls listed! breaking into multiple child elements.`)
            element.urls.forEach((childURL) => {
                let newElement = {
                    id: (element.id * 1000) + element.urls.indexOf(childURL),
                    tbl_title: element.tbl_title,
                    tbl_author: element.tbl_author,
                    hits: 1,
                    urls: [childURL]
                }
                scrapeDetails(newElement)
                return
            })
        }
        else {
            let page = await browser.newPage({})
            let url = element.urls.pop()
            console.log(`[scrapeDetails—${element.id}] retrieving details for '${element.tbl_title}' from ${url}`)
            await page.goto(url).catch(()=>{return})
            await waitForNetworkIdle(page, 500, 0)
            let cela_details = await page.evaluate(() => {
                let cela_details = {
                    title: document.querySelector("div.book-details--title > h1") != null ? document.querySelector("div.book-details--title > h1").innerText : '',
                    author: document.querySelector("p.book-details--author") != null ? document.querySelector("p.book-details--author").innerText.replace(/By /g, '') : '',
                    genre: document.querySelector(".book-details--body > p:nth-child(1)") != null ? document.querySelector(".book-details--body > p:nth-child(1)").innerText : '',
                    narration_type: document.querySelector(".book-details--body > p:nth-child(2)") != null ? document.querySelector(".book-details--body > p:nth-child(2)").innerText : '',
                    summary_pt1: document.querySelector(".book-details--summary") != null ? document.querySelector(".book-details--summary").innerText.replace(/… \(Show full summary\)/g, ' ') : '',
                    summary_pt2: document.querySelector("span.summary-remainder") != null ? document.querySelector("span.summary-remainder").innerText : '',
                    isbn: document.querySelector(".field--name-field-isbn13") != null ? document.querySelector(".field--name-field-isbn13").innerText.replace(/ISBN[\n]/g, '') : '',
                    publisher: document.querySelector(".field--name-field-publisher") != null ? document.querySelector(".field--name-field-publisher").innerText.replace(/Publisher[\n]/g, '') : '',
                    copyright_date: document.querySelector(".field--name-field-copyrightdate") != null ? document.querySelector(".field--name-field-copyrightdate").innerText.replace(/Copyright Date[\n]/g, '') : '',
                    cela_book_number: document.querySelector("div.book-details--details > div:nth-child(1) > div:nth-child(5)") != null ? document.querySelector("div.book-details--details > div:nth-child(1) > div:nth-child(5)").innerText.replace(/Book number[\n]/g, '') : '',
                    audio_narrator: document.querySelector(".field--name-field-artifact-narrator-name") != null ? document.querySelector(".field--name-field-artifact-narrator-name").innerText.replace(/Narrator[\n]/g, '') : '',
                    audio_duration: document.querySelector(".field--name-field-artifact-duration") != null ? document.querySelector(".field--name-field-artifact-duration").innerText.replace(/Duration[\n]/g, '') : '',
                    audio_producer: document.querySelector(".field--name-field-artifact-audio-producer") != null ? document.querySelector(".field--name-field-artifact-audio-producer").innerText.replace(/Audio producer[\n]/g, '').replace(/, \d*.*/g, '') : '',
                    audio_production_date: document.querySelector(".field--name-field-artifact-audio-producer") != null ? document.querySelector(".field--name-field-artifact-audio-producer").innerText.replace(/\D/g, '') : '',
                }
                return cela_details
            })
            await parseDetails(cela_details, element, url)
            await page.close()
            return (cela_details)
        }
        return
    }

    async function parseDetails(cela_details, element, url) {
        let d = {
            title: cela_details.title,
            author: cela_details.author,
            genre: cela_details.genre,
            narration_type: cela_details.narration_type,
            summary: `${cela_details.summary_pt1}${cela_details.summary_pt2}`,
            isbn: cela_details.isbn,
            publisher: cela_details.publisher,
            copyright_date: cela_details.copyright_date,
            cela_book_number: cela_details.cela_book_number,
            audio_narrator: cela_details.audio_narrator,
            audio_duration: cela_details.audio_duration,
            audio_producer: cela_details.audio_producer,
            audio_production_date: cela_details.audio_production_date,
            raw_url: url,
            wp_url: `<a href="${url}" target="_blank">${cela_details.title}</a>`,
            google_spreadheet_url: `=HYPERLINK("${url}", "${cela_details.title}")`,
            tbl_id: element.id
        }
        console.log(`[parseDetails—${element.id}] details:`, d)
        let sqlArr = [d.title, d.author, d.genre, d.narration_type, d.summary, d.isbn, d.publisher, d.copyright_date, d.cela_book_number, d.audio_narrator, d.audio_duration, d.audio_producer, d.audio_production_date, d.raw_url, d.wp_url, d.google_spreadheet_url, d.tbl_id]
        await postDetails(sqlArr)
        return d
    }
}

async function postDetails(details) {
    var sql = `INSERT INTO ${productionTable} (title, author, genre, narration_type, summary, isbn, publisher, copyright_date, cela_book_number, audio_narrator, audio_durration, audio_producer, audio_production_date, raw_url, wp_url, google_spreadheet_url, tbl_id) VALUES (?)`;
    connection.query(sql, [SqlString.format(details)], function (err, result) {
      if (err) throw err;
    })
    console.log(`[postDetails—${details[15]}] succesfully posted details for '${details[0]}'!\n`)
    return
  }

function waitForNetworkIdle(page, timeout, maxInflightRequests = 0) {
    page.on('request', onRequestStarted)
    page.on('requestfinished', onRequestFinished)
    page.on('requestfailed', onRequestFinished)
    let inflight = 0
    let fulfill
    let promise = new Promise(x => fulfill = x)
    let timeoutId = setTimeout(onTimeoutDone, timeout)
    return promise
    function onTimeoutDone() {
        page.removeListener('request', onRequestStarted)
        page.removeListener('requestfinished', onRequestFinished)
        page.removeListener('requestfailed', onRequestFinished)
        fulfill()
    }
    function onRequestStarted() {
        ++inflight
        if (inflight > maxInflightRequests)
            clearTimeout(timeoutId)
    }
    function onRequestFinished() {
        if (inflight === 0)
            return
        --inflight
        if (inflight === maxInflightRequests)
            timeoutId = setTimeout(onTimeoutDone, timeout)
    }
}