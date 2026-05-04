class ProxyRotation {
  constructor() {
    // Free proxy sources
    this.freeProxies = [
      // Format: { host: 'ip', port: 8080, protocol: 'http' }
      // These would be populated from free proxy APIs
    ];
    
    this.currentProxyIndex = 0;
    this.failedProxies = new Set();
    this.proxySources = [
      'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY_LIST/master/http.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt'
    ];
  }

  async fetchFreeProxies() {
    try {
      for (const source of this.freeProxies) {
        const response = await fetch(source);
        const text = await response.text();
        const proxies = this.parseProxyList(text);
        this.freeProxies.push(...proxies);
      }
    } catch (error) {
      console.error('Failed to fetch free proxies:', error);
    }
  }

  parseProxyList(text) {
    const lines = text.split('\n');
    const proxies = [];
    
    for (const line of lines) {
      const parts = line.trim().split(':');
      if (parts.length >= 2) {
        const host = parts[0];
        const port = parseInt(parts[1]);
        
        if (this.isValidIP(host) && this.isValidPort(port)) {
          proxies.push({
            host,
            port,
            protocol: 'http'
          });
        }
      }
    }
    
    return proxies;
  }

  isValidIP(ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  isValidPort(port) {
    return port >= 1 && port <= 65535;
  }

  getNextProxy() {
    if (this.freeProxies.length === 0) {
      return null;
    }

    let attempts = 0;
    const maxAttempts = this.freeProxies.length;

    while (attempts < maxAttempts) {
      const proxy = this.freeProxies[this.currentProxyIndex];
      this.currentProxyIndex = (this.currentProxyIndex + 1) % this.freeProxies.length;

      if (!this.failedProxies.has(`${proxy.host}:${proxy.port}`)) {
        return proxy;
      }

      attempts++;
    }

    // All proxies failed, reset and try again
    this.failedProxies.clear();
    return this.freeProxies[0] || null;
  }

  markProxyFailed(proxy) {
    this.failedProxies.add(`${proxy.host}:${proxy.port}`);
  }

  markProxySuccess(proxy) {
    this.failedProxies.delete(`${proxy.host}:${proxy.port}`);
  }

  getProxyString(proxy) {
    if (!proxy) return null;
    return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
  }

  async testProxy(proxy) {
    try {
      const response = await fetch('http://httpbin.org/ip', {
        proxy: this.getProxyString(proxy),
        timeout: 10000
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.origin !== proxy.host; // Should show different IP
      }
    } catch (error) {
      return false;
    }
    
    return false;
  }

  async getWorkingProxy() {
    await this.fetchFreeProxies();
    
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const proxy = this.getNextProxy();
      if (!proxy) break;

      const isWorking = await this.testProxy(proxy);
      
      if (isWorking) {
        this.markProxySuccess(proxy);
        return proxy;
      } else {
        this.markProxyFailed(proxy);
      }

      attempts++;
    }

    return null;
  }

  // Tor network integration (optional)
  getTorProxy() {
    return {
      host: '127.0.0.1',
      port: 9050,
      protocol: 'socks5'
    };
  }

  async isTorAvailable() {
    try {
      const response = await fetch('https://check.torproject.org/api/ip', {
        proxy: 'socks5://127.0.0.1:9050',
        timeout: 10000
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ProxyRotation;
