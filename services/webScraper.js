const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

class WebScraper {
  constructor() {
    this.browser = null;
    this.userAgent = new UserAgent();
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async googleSearch(query, numResults = 10) {
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      // Set random user agent
      await page.setUserAgent(this.userAgent.toString());
      
      // Go to Google
      await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
      
      // Accept cookies if present
      try {
        await page.click('button[data-testid="L2AGLb"]', { timeout: 3000 });
      } catch (e) {
        // Cookie button not found, continue
      }
      
      // Type search query
      await page.type('textarea[name="q"]', query);
      await page.keyboard.press('Enter');
      
      // Wait for results
      await page.waitForSelector('#search', { timeout: 10000 });
      
      // Extract results
      const results = await page.evaluate(() => {
        const searchResults = [];
        const elements = document.querySelectorAll('div.g');
        
        elements.forEach(element => {
          const titleElement = element.querySelector('h3');
          const linkElement = element.querySelector('a');
          const snippetElement = element.querySelector('[data-st="true"]');
          
          if (titleElement && linkElement) {
            searchResults.push({
              title: titleElement.textContent.trim(),
              url: linkElement.href,
              snippet: snippetElement ? snippetElement.textContent.trim() : ''
            });
          }
        });
        
        return searchResults.slice(0, 10);
      });
      
      return results;
    } catch (error) {
      console.error('Google search error:', error);
      return [];
    } finally {
      await page.close();
    }
  }

  async scrapePage(url) {
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.userAgent.toString());
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);
      
      // Extract structured data
      const pageData = {
        url: url,
        title: $('title').text().trim(),
        meta: {
          description: $('meta[name="description"]').attr('content'),
          keywords: $('meta[name="keywords"]').attr('content')
        },
        headings: {
          h1: $('h1').map((i, el) => $(el).text().trim()).get(),
          h2: $('h2').map((i, el) => $(el).text().trim()).get(),
          h3: $('h3').map((i, el) => $(el).text().trim()).get()
        },
        text: $('body').text().trim().replace(/\s+/g, ' '),
        links: $('a[href]').map((i, el) => ({
          text: $(el).text().trim(),
          href: $(el).attr('href')
        })).get(),
        images: $('img[src]').map((i, el) => ({
          alt: $(el).attr('alt'),
          src: $(el).attr('src')
        })).get()
      };
      
      return pageData;
    } catch (error) {
      console.error('Page scraping error:', error);
      return null;
    } finally {
      await page.close();
    }
  }

  async searchAndScrape(query, maxPages = 3) {
    const searchResults = await this.googleSearch(query);
    const detailedResults = [];
    
    for (let i = 0; i < Math.min(searchResults.length, maxPages); i++) {
      const result = searchResults[i];
      const pageData = await this.scrapePage(result.url);
      
      if (pageData) {
        detailedResults.push({
          ...result,
          scrapedData: pageData
        });
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return detailedResults;
  }
}

module.exports = WebScraper;
