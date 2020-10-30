# Talking Book Library Scraping Tools (TBLST)

## Background

In order to update and enhance the user experience of the [Talking Book Library website](https://www.talkingbooklibrary.ca/tbl-book-list-2/), Elliot Young, a part-time student worker wrote two scraping tools for the use of TBL to scrape the CELA database for TBL's booklist

## Installation
Clone the repo

```bash
git clone https://github.com/elliot-wheaton/tbl-scripts.git
```

To get started, navigate to the 'tbl' folder and use the package manager [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) to install Google Puppeteer and related dependencies.

```bash
cd tbl
npm i
```

### DB Setup
Create a new [MySQL](https://dev.mysql.com/doc/mysql-installation-excerpt/5.7/en/) Database with two tables: 'source', and 'result'. In terminal login to the MySQL editor:

```bash
sudo mysql -p
```

Create the two tables:

```mysql
CREATE TABLE `source` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tbl_title` text,
  `tbl_author` text,
  `urls` text,
  `hits` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=790 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `result` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` text,
  `author` text,
  `genre` text,
  `narration_type` text,
  `summary` text,
  `isbn` text,
  `publisher` text,
  `copyright_date` text,
  `cela_book_number` text,
  `audio_narrator` text,
  `audio_durration` text,
  `audio_producer` text,
  `audio_production_date` text,
  `raw_url` text,
  `wp_url` text,
  `google_spreadheet_url` text,
  `tbl_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=796 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```
### Set your environment variables.

In the project directory is a file called .env_example. This holds all of the necessary environment variables for the Node scripts to use the Database Tables you just created.

Rename the file to just '.env' by removing '_example' from the file name.

Make sure all your credentials are updated:
```.env
DB_HOST=localhost
DB_USER=root
DB_PASS=secret
DB=tbl_booklist
DB_SOURCE_TABLE=source
DB_RESULT_TABLE=production
```

## Usage
The scraping takes place in two parts: first scaring for the URLs from CELA, then scraping for the data at each URL.
### Scraping the URLs
The first step of the scraping process is to scrape for the URLs associated with the TBL books on the CELA website. Navigate to the folder 'tbl' and run the node program url_scraper:
```bash
cd tbl
node url_scraper.js
```
Wait for this process to complete and watch the console output for any crashes.

### Scraping the CELA Data
The second step of the scraping process is to scrape for all relevant data at each URL scraped in the last step. Navigate to the folder 'tbl' and run the node program url_scraper:
```bash
cd tbl
node details_scraper.js
```
When this process is complete, verify that your tables are populated with the new data and push it to production!

## License
[MIT](https://choosealicense.com/licenses/mit/)