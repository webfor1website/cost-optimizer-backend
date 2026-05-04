const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { UserAgent } = require('user-agents');
const cheerio = require('cheerio');
const DetectionEvasion = require('./detectionEvasion');
const ProxyRotation = require('./proxyRotation');

puppeteer.use(StealthPlugin());

class WebScraper {
  constructor() {
    this.browser = null;
    this.userAgent = new UserAgent();
    this.evasion = new DetectionEvasion();
    this.proxyRotation = new ProxyRotation();
    this.currentProxy = null;
  }

  async initialize() {
    if (!this.browser) {
      // Try to get a working proxy
      this.currentProxy = await this.proxyRotation.getWorkingProxy();
      
      // Fall back to Tor if no free proxy works
      if (!this.currentProxy && await this.proxyRotation.isTorAvailable()) {
        this.currentProxy = this.proxyRotation.getTorProxy();
      }
      
      this.browser = await this.evasion.createStealthBrowser(puppeteer, this.currentProxy);
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

  async multiEngineSearch(query) {
    await this.initialize();
    const page = await this.browser.newPage();
    const engine = this.evasion.getRandomSearchEngine();
    
    try {
      await this.evasion.applyFingerprint(page, this.evasion.sessionFingerprint);
      
      if (engine.name === 'google') {
        await page.goto('https://www.google.com/search?q=' + encodeURIComponent(query), {
          waitUntil: 'networkidle2'
        });
      } else if (engine.name === 'duckduckgo') {
        await page.goto('https://duckduckgo.com/', { waitUntil: 'networkidle2' });
        await this.evasion.simulateMouseMovement(page, 400, 300);
        await page.click('#searchbox_input');
        await this.evasion.simulateTyping(page, '#searchbox_input', query);
        await this.evasion.humanDelay(500, 1500);
        await page.keyboard.press('Enter');
        await page.waitForSelector('.result', { timeout: 10000 });
      } else if (engine.name === 'bing') {
        await page.goto('https://www.bing.com/search?q=' + encodeURIComponent(query), {
          waitUntil: 'networkidle2'
        });
      }
      
      await this.evasion.humanDelay(1000, 3000);
      await this.evasion.simulateScrolling(page);
      
      const results = await this.extractResults(page, engine);
      
      return results;
    } finally {
      await page.close();
    }
  }

  async extractResults(page, engine) {
    const results = await page.evaluate((engine) => {
      const searchResults = [];
      let elements = [];
      
      if (engine.name === 'google') {
        elements = document.querySelectorAll('.g');
      } else if (engine.name === 'duckduckgo') {
        elements = document.querySelectorAll('.result');
      } else if (engine.name === 'bing') {
        elements = document.querySelectorAll('.b_algo');
      }
      
      elements.forEach(element => {
        let titleElement, linkElement, snippetElement;
        
        if (engine.name === 'google') {
          titleElement = element.querySelector('h3');
          linkElement = element.querySelector('a');
          snippetElement = element.querySelector('.VwiC3b');
        } else if (engine.name === 'duckduckgo') {
          titleElement = element.querySelector('.result__a');
          linkElement = element.querySelector('.result__a');
          snippetElement = element.querySelector('.result__snippet');
        } else if (engine.name === 'bing') {
          titleElement = element.querySelector('h2');
          linkElement = element.querySelector('h2 a');
          snippetElement = element.querySelector('.b_caption p');
        }
        
        if (titleElement && linkElement) {
          searchResults.push({
            title: titleElement.textContent,
            url: linkElement.href,
            snippet: snippetElement ? snippetElement.textContent : '',
            engine: engine.name
          });
        }
      });
      
      return searchResults.slice(0, 10);
    }, engine);
    
    return results;
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

  async searchAndScrape(query, numResults = 5) {
    const searchResults = await this.multiEngineSearch(query);
    const detailedResults = [];
    
    for (let i = 0; i < Math.min(numResults, searchResults.length); i++) {
      const result = searchResults[i];
      const scrapedData = await this.scrapePage(result.url);
      
      detailedResults.push({
        ...result,
        scrapedData: scrapedData
      });
      
      // Add human-like delay between requests
      await this.evasion.humanDelay(2000, 5000);
    }
    
    return detailedResults;
  }
}

module.exports = WebScraper;
