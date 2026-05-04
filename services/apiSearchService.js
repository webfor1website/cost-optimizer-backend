const axios = require('axios');

class APISearchService {
  constructor() {
    // Free API options
    this.searchSources = [
      {
        name: 'duckduckgo',
        url: 'https://api.duckduckgo.com/',
        formatResponse: (data) => this.formatDuckDuckGoResults(data)
      },
      {
        name: 'brave',
        url: 'https://search.brave.com/search',
        formatResponse: (data) => this.formatBraveResults(data)
      }
    ];
    
    this.currentSource = 0;
  }

  async search(query) {
    const source = this.searchSources[this.currentSource];
    this.currentSource = (this.currentSource + 1) % this.searchSources.length;
    
    try {
      const results = await this.performSearch(source, query);
      return results;
    } catch (error) {
      console.error(`${source.name} search failed:`, error);
      // Try next source
      return this.search(query);
    }
  }

  async performSearch(source, query) {
    if (source.name === 'duckduckgo') {
      return this.searchDuckDuckGo(query);
    } else if (source.name === 'brave') {
      return this.searchBrave(query);
    }
  }

  async searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const results = response.data.RelatedTopics || [];
      return this.formatDuckDuckGoResults(results);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  async searchBrave(query) {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000
      });

      const html = response.data;
      const results = this.parseBraveResults(html);
      return results;
    } catch (error) {
      console.error('Brave search error:', error);
      return [];
    }
  }

  formatDuckDuckGoResults(topics) {
    return topics
      .filter(topic => topic.Text && topic.FirstURL)
      .slice(0, 10)
      .map(topic => ({
        title: this.cleanText(topic.Text),
        url: topic.FirstURL,
        snippet: this.extractSnippet(topic.Text),
        engine: 'duckduckgo'
      }));
  }

  parseBraveResults(html) {
    const results = [];
    const regex = /<div class="web-result"[^>]*>[\s\S]*?<\/div>/g;
    const matches = html.match(regex);

    if (matches) {
      matches.slice(0, 10).forEach(match => {
        const titleMatch = match.match(/<h3[^>]*>(.*?)<\/h3>/);
        const urlMatch = match.match(/<a[^>]*href="([^"]*)"[^>]*>/);
        const snippetMatch = match.match(/<div class="snippet"[^>]*>(.*?)<\/div>/);

        if (titleMatch && urlMatch) {
          results.push({
            title: this.cleanText(titleMatch[1]),
            url: urlMatch[1],
            snippet: snippetMatch ? this.cleanText(snippetMatch[1]) : '',
            engine: 'brave'
          });
        }
      });
    }

    return results;
  }

  formatBraveResults(results) {
    return results;
  }

  cleanText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  extractSnippet(text) {
    // Extract first sentence or first 150 characters
    const cleaned = this.cleanText(text);
    const sentences = cleaned.split(/[.!?]+/);
    
    if (sentences.length > 0 && sentences[0].length > 20) {
      return sentences[0].trim();
    }
    
    return cleaned.substring(0, 150) + (cleaned.length > 150 ? '...' : '');
  }

  // Fallback to simulated results if all APIs fail
  generateFallbackResults(query) {
    const fallbackTemplates = {
      'generic': [
        {
          title: `${query} - Best Options Available`,
          url: 'https://example.com/search',
          snippet: `Find the best deals and options for ${query}. Compare prices and read reviews from verified buyers.`,
          engine: 'fallback'
        },
        {
          title: `Top ${query} Recommendations`,
          url: 'https://example.com/recommendations',
          snippet: `Expert recommendations for ${query}. Hand-picked options based on quality and value.`,
          engine: 'fallback'
        },
        {
          title: `${query} Buying Guide`,
          url: 'https://example.com/guide',
          snippet: `Complete buying guide for ${query}. Learn what to look for and how to save money.`,
          engine: 'fallback'
        }
      ]
    };

    return fallbackTemplates.generic;
  }
}

module.exports = APISearchService;
