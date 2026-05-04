class DetectionEvasion {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0'
    ];
    
    this.screenResolutions = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1536, height: 864 },
      { width: 1280, height: 720 }
    ];
    
    this.timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris'
    ];
    
    this.languages = [
      'en-US,en;q=0.9',
      'en-GB,en;q=0.9',
      'en;q=0.9'
    ];
    
    this.searchEngines = [
      { name: 'google', url: 'https://www.google.com/search', selector: '#search .g' },
      { name: 'duckduckgo', url: 'https://duckduckgo.com/', selector: '.result' },
      { name: 'bing', url: 'https://www.bing.com/search', selector: '.b_algo' }
    ];
    
    this.currentEngine = 0;
    this.sessionFingerprint = null;
  }

  generateFingerprint() {
    return {
      userAgent: this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
      screenResolution: this.screenResolutions[Math.floor(Math.random() * this.screenResolutions.length)],
      timezone: this.timezones[Math.floor(Math.random() * this.timezones.length)],
      language: this.languages[Math.floor(Math.random() * this.languages.length)],
      platform: Math.random() > 0.5 ? 'Win32' : 'MacIntel',
      hardwareConcurrency: Math.floor(Math.random() * 8) + 4,
      deviceMemory: Math.floor(Math.random() * 8) + 4,
      colorDepth: 24,
      pixelDepth: 24
    };
  }

  async humanDelay(min = 100, max = 3000) {
    const delay = min + Math.random() * (max - min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async simulateMouseMovement(page, targetX, targetY) {
    const startX = Math.floor(Math.random() * window.innerWidth);
    const startY = Math.floor(Math.random() * window.innerHeight);
    
    const steps = 10 + Math.floor(Math.random() * 20);
    const deltaX = (targetX - startX) / steps;
    const deltaY = (targetY - startY) / steps;
    
    await page.mouse.move(startX, startY);
    
    for (let i = 1; i <= steps; i++) {
      const currentX = startX + deltaX * i;
      const currentY = startY + deltaY * i;
      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 10;
      
      await page.mouse.move(currentX + jitterX, currentY + jitterY);
      await this.humanDelay(10, 50);
    }
    
    await this.humanDelay(100, 500);
  }

  async simulateTyping(page, selector, text) {
    await page.focus(selector);
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const delay = 50 + Math.random() * 150;
      
      await page.keyboard.type(char, { delay });
      
      if (Math.random() < 0.05) {
        await this.humanDelay(200, 800);
      }
      
      if (Math.random() < 0.02) {
        await page.keyboard.press('Backspace');
        await this.humanDelay(100, 300);
        await page.keyboard.type(char);
      }
    }
  }

  async simulateScrolling(page) {
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    let currentScroll = 0;
    const scrollSteps = Math.floor(scrollHeight / viewportHeight);
    
    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = viewportHeight + Math.random() * 200;
      currentScroll += scrollAmount;
      
      await page.evaluate((scroll) => window.scrollTo(0, scroll), currentScroll);
      await this.humanDelay(500, 2000);
      
      if (Math.random() < 0.3) {
        await page.evaluate((scroll) => window.scrollTo(0, scroll - 200), currentScroll);
        await this.humanDelay(300, 1000);
        await page.evaluate((scroll) => window.scrollTo(0, scroll), currentScroll);
      }
    }
  }

  getRandomSearchEngine() {
    const engine = this.searchEngines[this.currentEngine];
    this.currentEngine = (this.currentEngine + 1) % this.searchEngines.length;
    return engine;
  }

  async applyFingerprint(page, fingerprint) {
    await page.setUserAgent(fingerprint.userAgent);
    await page.setViewport({
      width: fingerprint.screenResolution.width,
      height: fingerprint.screenResolution.height,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: fingerprint.screenResolution.width > fingerprint.screenResolution.height
    });
    
    await page.evaluateOnNewDocument((fingerprint) => {
      Object.defineProperty(navigator, 'platform', {
        get: () => fingerprint.platform
      });
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => fingerprint.hardwareConcurrency
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => fingerprint.deviceMemory
      });
      
      Object.defineProperty(navigator, 'language', {
        get: () => fingerprint.language.split(',')[0]
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => fingerprint.language.split(',')
      });
      
      Object.defineProperty(screen, 'colorDepth', {
        get: () => fingerprint.colorDepth
      });
      
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => fingerprint.pixelDepth
      });
      
      const originalQuery = window.matchMedia;
      window.matchMedia = (query) => {
        const result = originalQuery(query);
        result.addEventListener = () => {};
        result.removeListener = () => {};
        return result;
      };
    }, fingerprint);
  }

  async createStealthBrowser(puppeteer, proxy = null) {
    const fingerprint = this.generateFingerprint();
    this.sessionFingerprint = fingerprint;
    
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection',
      '--window-size=' + fingerprint.screenResolution.width + ',' + fingerprint.screenResolution.height,
      '--user-agent=' + fingerprint.userAgent
    ];
    
    if (proxy) {
      if (proxy.protocol === 'socks5') {
        args.push(`--proxy-server=socks5://${proxy.host}:${proxy.port}`);
      } else {
        args.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
      }
    }
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args
    });
    
    return browser;
  }
}

module.exports = DetectionEvasion;
