const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserAgent = require('user-agents');

puppeteer.use(StealthPlugin());

class GrokIntegration {
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

  async analyzeWithGrok(prompt, context = '') {
    await this.initialize();
    const page = await this.browser.newPage();
    
    try {
      await page.setUserAgent(this.userAgent.toString());
      
      // Go to X/Twitter
      await page.goto('https://x.com', { waitUntil: 'networkidle2', timeout: 20000 });
      
      // Wait for page to load
      await page.waitForTimeout(3000);
      
      // Try to find Grok button or link
      let grokButton = null;
      
      // Try different selectors for Grok
      const selectors = [
        'a[href*="grok"]',
        'button[aria-label*="Grok"]',
        'div[data-testid="grok"]',
        'span:contains("Grok")',
        '[data-testid="grok-button"]'
      ];
      
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          grokButton = await page.$(selector);
          if (grokButton) break;
        } catch (e) {
          continue;
        }
      }
      
      if (!grokButton) {
        // Try to navigate directly to Grok
        await page.goto('https://x.com/i/grok', { waitUntil: 'networkidle2', timeout: 15000 });
        await page.waitForTimeout(3000);
      }
      
      // Look for input field
      let inputSelector = null;
      const inputSelectors = [
        'textarea[placeholder*="Ask"]',
        'textarea[placeholder*="Grok"]',
        'textarea[aria-label*="Ask"]',
        'div[contenteditable="true"]',
        'textarea[data-testid="tweetTextarea"]',
        'input[type="text"]'
      ];
      
      for (const selector of inputSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          const input = await page.$(selector);
          if (input) {
            inputSelector = selector;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!inputSelector) {
        throw new Error('Could not find Grok input field');
      }
      
      // Construct the full prompt
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
      
      // Type the prompt
      await page.type(inputSelector, fullPrompt, { delay: 50 });
      
      // Look for submit button
      let submitSelector = null;
      const submitSelectors = [
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'button[aria-label*="Post"]',
        'div[role="button"]:contains("Send")',
        'div[role="button"]:contains("Submit")'
      ];
      
      for (const selector of submitSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          const button = await page.$(selector);
          if (button) {
            submitSelector = selector;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (submitSelector) {
        await page.click(submitSelector);
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }
      
      // Wait for response
      await page.waitForTimeout(5000);
      
      // Look for response
      let responseSelector = null;
      const responseSelectors = [
        '[data-testid="grok-response"]',
        '.grok-response',
        '[data-testid="tweetText"]',
        'div[data-testid="tweet"]',
        '.response-text',
        '.grok-answer'
      ];
      
      let responseText = '';
      
      for (const selector of responseSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          responseText = await page.$eval(selector, el => el.textContent.trim());
          if (responseText) break;
        } catch (e) {
          continue;
        }
      }
      
      // If no specific response found, try to get the last tweet/message
      if (!responseText) {
        try {
          const tweets = await page.$$eval('[data-testid="tweet"]', tweets => 
            tweets.map(tweet => tweet.textContent.trim())
          );
          responseText = tweets[tweets.length - 1] || '';
        } catch (e) {
          // Fallback to page text
          responseText = await page.evaluate(() => document.body.innerText);
        }
      }
      
      return {
        success: true,
        response: responseText,
        prompt: fullPrompt,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Grok integration error:', error);
      return {
        success: false,
        error: error.message,
        prompt: prompt,
        timestamp: new Date().toISOString()
      };
    } finally {
      await page.close();
    }
  }

  async analyzeCostOptimization(searchResults, userRequest) {
    const context = `I need you to analyze these search results for cost optimization. The user is looking for: "${userRequest}"

Here are the search results I found:
${searchResults.map((result, index) => 
  `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Snippet: ${result.snippet}\n   ${result.scrapedData ? `Content preview: ${result.scrapedData.text.substring(0, 300)}...` : ''}`
).join('\n\n')}

Please analyze these results and provide:
1. The top 3 most cost-effective options with specific names
2. Exact prices if mentioned in the results
3. Cost per unit/value analysis
4. Where to buy each option (store/website)
5. A brief reasoning for each recommendation focusing on cost savings

Format your response as:
1. [Option Name] - $[Price] - [Where to buy] - [Reasoning]
2. [Option Name] - $[Price] - [Where to buy] - [Reasoning]  
3. [Option Name] - $[Price] - [Where to buy] - [Reasoning]

Focus ONLY on cost optimization and saving money. Be specific and actionable.`;

    return await this.analyzeWithGrok(context);
  }

  async extractPricingInfo(text) {
    const prompt = `Extract any pricing information from this text and convert it to a structured format. Look for:
    - Exact prices ($XX.XX)
    - Price ranges ($XX-$YY)
    - Monthly costs
    - One-time fees
    - Value comparisons

    Text: ${text}

    Return the results in JSON format with price, frequency, and context fields.`;
    
    return await this.analyzeWithGrok(prompt);
  }
}

module.exports = GrokIntegration;
