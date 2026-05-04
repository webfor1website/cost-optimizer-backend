const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const NodeGeocoder = require('node-geocoder');
const path = require('path');
const WebScraper = require('./services/webScraper');
const GrokIntegration = require('./services/grokIntegration');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Geocoder setup
const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  httpAdapter: 'https',
  formatter: null
});

// Cost Optimization Engine
class CostOptimizer {
  constructor() {
    this.apiKeys = {
      googlePlaces: process.env.GOOGLE_PLACES_API_KEY,
      walmart: process.env.WALMART_API_KEY,
      target: process.env.TARGET_API_KEY,
      edmunds: process.env.EDMUNDS_API_KEY
    };
  }

  async optimizeRequest(userRequest, userLocation = null) {
    const requestType = this.categorizeRequest(userRequest);
    
    switch(requestType) {
      case 'automotive':
        return await this.optimizeAutomotive(userRequest);
      case 'groceries':
        return await this.optimizeGroceries(userRequest, userLocation);
      case 'general_product':
        return await this.optimizeGeneralProduct(userRequest, userLocation);
      case 'service':
        return await this.optimizeService(userRequest, userLocation);
      default:
        return await this.optimizeGeneral(userRequest, userLocation);
    }
  }

  categorizeRequest(request) {
    const keywords = {
      automotive: ['car', 'vehicle', 'truck', 'suv', 'automobile', 'auto'],
      groceries: ['beer', 'food', 'grocery', 'alcohol', 'drink', 'milk', 'bread'],
      service: ['repair', 'service', 'maintenance', 'cleaning', 'installation'],
      general_product: ['product', 'item', 'buy', 'purchase', 'price']
    };

    const lowerRequest = request.toLowerCase();
    
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => lowerRequest.includes(word))) {
        return category;
      }
    }
    
    return 'general';
  }

  async optimizeAutomotive(request) {
    // Simulate automotive optimization
    const options = [
      {
        name: '2023 Honda Civic LX',
        price: 23950,
        estimatedLifetime: 8,
        dailyCost: 8.20,
        roi: 0.75,
        fuelEfficiency: 35,
        maintenanceCost: 3500,
        resaleValue: 0.65,
        reasoning: 'Best balance of price, reliability, and resale value'
      },
      {
        name: '2023 Toyota Corolla LE',
        price: 22795,
        estimatedLifetime: 10,
        dailyCost: 7.80,
        roi: 0.82,
        fuelEfficiency: 32,
        maintenanceCost: 3000,
        resaleValue: 0.68,
        reasoning: 'Highest reliability and lowest maintenance costs'
      },
      {
        name: '2023 Hyundai Elantra SE',
        price: 20995,
        estimatedLifetime: 7,
        dailyCost: 7.20,
        roi: 0.78,
        fuelEfficiency: 37,
        maintenanceCost: 4000,
        resaleValue: 0.60,
        reasoning: 'Lowest initial cost with good fuel economy'
      }
    ];

    return {
      category: 'automotive',
      request: request,
      topOptions: options.sort((a, b) => b.roi - a.roi).slice(0, 3),
      analysis: {
        totalOptions: options.length,
        averagePrice: options.reduce((sum, opt) => sum + opt.price, 0) / options.length,
        bestROI: Math.max(...options.map(opt => opt.roi)),
        lowestDailyCost: Math.min(...options.map(opt => opt.dailyCost))
      }
    };
  }

  async optimizeGroceries(request, userLocation) {
    const query = this.extractProductQuery(request);
    const stores = await this.findNearbyStores(userLocation);
    
    const options = await Promise.all(stores.map(async (store) => {
      const price = await this.getProductPrice(query, store);
      return {
        store: store.name,
        address: store.address,
        distance: store.distance,
        price: price,
        quantity: this.extractQuantity(request),
        unitPrice: price / this.extractQuantity(request),
        availability: Math.random() > 0.2, // Simulate availability
        reasoning: `${store.distance.toFixed(1)} miles away, $${price.toFixed(2)} total`
      };
    }));

    return {
      category: 'groceries',
      request: request,
      query: query,
      topOptions: options.filter(opt => opt.availability).sort((a, b) => a.price - b.price).slice(0, 3),
      analysis: {
        totalStores: stores.length,
        availableStores: options.filter(opt => opt.availability).length,
        averagePrice: options.reduce((sum, opt) => sum + opt.price, 0) / options.length,
        bestValue: options.sort((a, b) => a.unitPrice - b.unitPrice)[0]
      }
    };
  }

  async optimizeGeneralProduct(request, userLocation) {
    // Similar to groceries but for general products
    return this.optimizeGroceries(request, userLocation);
  }

  async optimizeService(request, userLocation) {
    // Service optimization logic
    const services = [
      {
        provider: 'Local Pro Services',
        price: 150,
        rating: 4.8,
        responseTime: '2 hours',
        quality: 0.9,
        reasoning: 'Highest rated, fast response'
      },
      {
        provider: 'Quick Fix Company',
        price: 120,
        rating: 4.2,
        responseTime: '4 hours',
        quality: 0.75,
        reasoning: 'Lower cost, reasonable quality'
      },
      {
        provider: 'Premium Services Inc',
        price: 200,
        rating: 4.9,
        responseTime: '1 hour',
        quality: 0.95,
        reasoning: 'Best quality, fastest service'
      }
    ];

    const costPerQuality = services.map(service => ({
      ...service,
      costPerQualityPoint: service.price / service.quality
    }));

    return {
      category: 'service',
      request: request,
      topOptions: costPerQuality.sort((a, b) => a.costPerQualityPoint - b.costPerQualityPoint).slice(0, 3),
      analysis: {
        averageCost: services.reduce((sum, svc) => sum + svc.price, 0) / services.length,
        bestQuality: Math.max(...services.map(svc => svc.quality)),
        fastestResponse: '1 hour'
      }
    };
  }

  async optimizeGeneral(request, userLocation) {
    // Fallback general optimization
    return {
      category: 'general',
      request: request,
      topOptions: [
        {
          name: 'Option 1: Standard Choice',
          cost: 100,
          efficiency: 0.8,
          reasoning: 'Balanced cost and quality'
        },
        {
          name: 'Option 2: Budget Choice',
          cost: 75,
          efficiency: 0.6,
          reasoning: 'Lower cost, acceptable quality'
        },
        {
          name: 'Option 3: Premium Choice',
          cost: 150,
          efficiency: 0.9,
          reasoning: 'Higher cost, best quality'
        }
      ],
      analysis: {
        recommendation: 'Option 1 provides the best balance'
      }
    };
  }

  extractProductQuery(request) {
    // Extract the main product from the request
    const words = request.toLowerCase().split(' ');
    const productWords = words.filter(word => 
      !['case', 'of', 'a', 'an', 'the', 'want', 'need', 'buy'].includes(word)
    );
    return productWords.join(' ');
  }

  extractQuantity(request) {
    const quantityMatch = request.match(/(\d+)\s*(case|pack|bottle|can)/i);
    if (quantityMatch) {
      return parseInt(quantityMatch[1]);
    }
    return 1; // Default quantity
  }

  async findNearbyStores(userLocation) {
    if (!userLocation || !userLocation.zip) {
      // Return default stores if no location provided
      return [
        { name: 'Walmart', address: '123 Main St', distance: 1.2 },
        { name: 'Target', address: '456 Oak Ave', distance: 2.1 },
        { name: 'Local Grocery', address: '789 Pine Rd', distance: 0.8 }
      ];
    }

    // Simulate finding nearby stores
    return [
      { name: 'Walmart', address: '123 Main St', distance: 1.2 },
      { name: 'Target', address: '456 Oak Ave', distance: 2.1 },
      { name: 'Costco', address: '321 Elm St', distance: 3.5 },
      { name: 'Local Grocery', address: '789 Pine Rd', distance: 0.8 }
    ];
  }

  async getProductPrice(product, store) {
    // Simulate price lookup
    const basePrices = {
      'beer': 15.99,
      'case beer': 18.99,
      'milk': 3.49,
      'bread': 2.99
    };

    const basePrice = basePrices[product.toLowerCase()] || 10.99;
    const storeMultiplier = {
      'Walmart': 1.0,
      'Target': 1.05,
      'Costco': 0.95,
      'Local Grocery': 1.10
    };

    return basePrice * (storeMultiplier[store.name] || 1.0);
  }
}

// Initialize services
const optimizer = new CostOptimizer();
const webScraper = new WebScraper();
const grokIntegration = new GrokIntegration();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/optimize', async (req, res) => {
  try {
    const { request, location } = req.body;
    
    if (!request) {
      return res.status(400).json({ error: 'Request is required' });
    }

    console.log('Starting web search optimization for:', request);
    
    // Step 1: Search and scrape results
    const searchResults = await webScraper.searchAndScrape(request, 5);
    console.log('Found search results:', searchResults.length);
    
    if (searchResults.length > 0) {
      // Step 2: Analyze with Grok
      console.log('Analyzing results with Grok...');
      const grokAnalysis = await grokIntegration.analyzeCostOptimization(searchResults, request);
      
      if (grokAnalysis.success) {
        // Parse Grok's response into structured format
        const result = await parseGrokResponse(grokAnalysis.response, request, searchResults);
        res.json(result);
      } else {
        console.log('Grok analysis failed:', grokAnalysis.error);
        res.status(500).json({ error: 'AI analysis failed. Please try again.' });
      }
    } else {
      console.log('No search results found');
      res.status(404).json({ error: 'No results found for your request. Please try different keywords.' });
    }
    
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

async function parseGrokResponse(grokResponse, userRequest, searchResults) {
  try {
    // Parse the formatted response: "1. [Option Name] - $[Price] - [Where to buy] - [Reasoning]"
    const lines = grokResponse.split('\n').filter(line => line.trim());
    const options = [];
    
    for (const line of lines) {
      // Match the expected format
      const match = line.match(/^(\d+)\.\s*(.+?)\s*-\s*\$?([^$-]*?)\s*-\s*([^$-]*?)\s*-\s*(.+)$/);
      if (match) {
        const [, number, name, price, whereToBuy, reasoning] = match;
        
        // Clean up the data
        const cleanPrice = price.trim() ? price.trim() : 'Price not specified';
        const cleanWhereToBuy = whereToBuy.trim() || 'Various retailers';
        const cleanReasoning = reasoning.trim();
        
        options.push({
          name: name.trim(),
          price: cleanPrice,
          whereToBuy: cleanWhereToBuy,
          reasoning: cleanReasoning,
          rank: parseInt(number),
          source: 'Grok Analysis'
        });
      }
    }
    
    // If we couldn't parse the expected format, try a more flexible approach
    if (options.length === 0) {
      for (const line of lines) {
        const numberMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (numberMatch) {
          const [, number, content] = numberMatch;
          const parts = content.split('-').map(part => part.trim());
          
          if (parts.length >= 2) {
            const name = parts[0];
            const price = parts[1].includes('$') ? parts[1] : 'Price not specified';
            const whereToBuy = parts[2] || 'Various retailers';
            const reasoning = parts.slice(3).join('-').trim() || 'Cost-effective option';
            
            options.push({
              name,
              price,
              whereToBuy,
              reasoning,
              rank: parseInt(number),
              source: 'Grok Analysis'
            });
          }
        }
      }
    }
    
    // If still no options, provide the full response as a single option
    if (options.length === 0) {
      return {
        category: 'web_analysis',
        request: userRequest,
        topOptions: [
          {
            name: 'AI Analysis Complete',
            price: 'See analysis',
            whereToBuy: 'Multiple options found',
            reasoning: grokResponse.substring(0, 200) + '...',
            details: [grokResponse],
            source: 'Grok Analysis'
          }
        ],
        analysis: {
          searchResults: searchResults.length,
          analysisType: 'AI_Powered',
          fullResponse: grokResponse
        }
      };
    }
    
    return {
      category: 'web_analysis',
      request: userRequest,
      topOptions: options.slice(0, 3),
      analysis: {
        searchResults: searchResults.length,
        analysisType: 'AI_Powered',
        optionsFound: options.length,
        fullResponse: grokResponse
      }
    };
    
  } catch (error) {
    console.error('Error parsing Grok response:', error);
    
    // Fallback response
    return {
      category: 'web_analysis',
      request: userRequest,
      topOptions: [
        {
          name: 'Analysis Available',
          price: 'See response',
          whereToBuy: 'Various',
          reasoning: 'AI analysis completed - see full response',
          details: [grokResponse],
          source: 'Grok Analysis'
        }
      ],
      analysis: {
        searchResults: searchResults.length,
        analysisType: 'AI_Powered',
        error: 'Parsing failed',
        fullResponse: grokResponse
      }
    };
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Cost Optimizer server running on port ${PORT}`);
});
