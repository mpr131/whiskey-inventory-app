# DYMO CellarTracker Approach - Local Framework Hosting

## Overview

This implementation follows CellarTracker's approach for DYMO label printing by hosting the DYMO Connect framework locally and serving everything over HTTPS. This solves all certificate and CORS issues.

## Key Components

### 1. Local Framework Hosting
- DYMO Connect framework is downloaded and saved to `/public/libs/dymo/dymo.connect.framework.js`
- Loaded from your own domain: `script.src = '/libs/dymo/dymo.connect.framework.js'`
- No external dependencies or certificate issues

### 2. HTTPS in Development
```json
// package.json
"scripts": {
  "dev": "next dev --experimental-https"
}
```

### 3. Direct DYMO Printing
When DYMO is detected:
- Labels print directly without browser dialog
- No certificate warnings
- No CORS issues
- Seamless user experience

## How It Works

1. **Framework Loading**:
   - Script loads from `/libs/dymo/dymo.connect.framework.js`
   - Framework initializes and detects DYMO printers
   - No external HTTPS calls needed

2. **Printer Detection**:
   ```javascript
   const printers = await window.dymo.connect.framework.getPrinters();
   ```

3. **Direct Printing**:
   ```javascript
   await window.dymo.connect.framework.printLabel(
     selectedPrinter,
     null,
     labelXml,
     null
   );
   ```

## Benefits

- **No Certificate Issues**: Framework is served from your domain
- **No CORS Problems**: All resources are local
- **Better User Experience**: Direct printing without dialogs
- **Fallback Support**: Still works with browser printing if DYMO not available

## Setup Instructions

1. **Run with HTTPS in development**:
   ```bash
   npm run dev
   ```

2. **For production**, ensure your site runs on HTTPS

3. **DYMO Connect must be installed** on the user's machine

## Label Format

Uses DYMO's XML format for 30252 Address labels (2.25" x 1.125"):
- Text object with whiskey details
- Optimized layout for small labels
- No QR code in XML (text only for simplicity)

## Troubleshooting

### DYMO Not Detected
1. Ensure DYMO Connect software is running
2. Check that your site is running on HTTPS
3. Verify the framework loaded: Check console for "DYMO framework loaded from local"

### Certificate Warning in Dev
When running with `--experimental-https`, accept the Next.js certificate warning once.

## Why This Works

CellarTracker's approach works because:
1. They host the framework themselves (no external HTTPS issues)
2. Their site runs on HTTPS (matches DYMO's requirement)
3. The framework handles the self-signed certificate internally
4. No mixed content or CORS issues

This is the most reliable approach for DYMO integration!