# Cost Optimizer Backend

## Deployment Instructions

This backend provides real-time Google search and Grok AI analysis for the cost optimizer.

### Quick Deploy to Render.com

1. Go to [render.com](https://render.com)
2. Click "New Web Service"
3. Connect to this GitHub repository (create it first)
4. Use these settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: `Free` (or paid for better performance)

### Environment Variables
No API keys required - uses web scraping for Google and Grok.

### Endpoints
- `POST /optimize` - Main optimization endpoint

## Features
- Real-time Google search
- Grok AI analysis
- Anti-detection measures
- Cost optimization for ANY request
