# DYMO Connect Label Printing Integration

This application supports direct printing to DYMO label printers using the DYMO Connect Web Service framework.

## Features

- **Automatic DYMO Printer Detection**: Detects all connected DYMO printers via web service
- **Direct Printing**: Print labels directly without browser print dialog
- **No Installation Required**: Uses DYMO Connect Web Service (runs on port 41951)
- **Fallback Support**: Falls back to browser printing if DYMO Connect not running
- **Custom Label Templates**: Optimized label layout for DYMO 30252 (1.125" x 2.25") labels

## Requirements

To use direct DYMO printing, users must have:
1. A DYMO LabelWriter printer connected
2. [DYMO Connect Software](https://www.dymo.com/support?cfid=online-support) installed and running
3. DYMO Connect Web Service active (automatically starts with DYMO Connect)

## How It Works

### 1. Web Service Integration
The app loads the DYMO Connect framework from GitHub:
```javascript
const script = document.createElement('script');
script.src = 'https://raw.githubusercontent.com/dymosoftware/dymo-connect-framework/master/dymo.connect.framework.js';
```

**Important**: We load from GitHub to bypass browser certificate issues. The framework handles the HTTPS connection to the local DYMO service internally.

### 2. Service Detection
The app checks if DYMO Connect service is running:
```javascript
// Let the framework handle the HTTPS connection
const printers = await window.dymo.connect.framework.getPrinters();
// Note: Don't use fetch() - let the framework handle it
```

### 3. Label Creation
Labels are created using DYMO's XML format with:
- Whiskey name (bold, size 11)
- Distillery name
- Proof and location details
- t8ke rating (if available)
- Purchase date (optional)
- QR code with vault barcode

### 4. Direct Printing
When a DYMO printer is detected:
```javascript
await window.dymo.connect.framework.printLabel(
  printerName,     // selected printer
  null,           // print params
  labelXml,       // label XML
  null,           // label set
  null            // object names
);
```

## User Experience

### With DYMO Connect Running
- Dropdown shows all available DYMO printers
- Green checkmark indicates "✓ DYMO Connect service detected"
- Labels print directly without browser dialog
- Immediate feedback when label is sent to printer

### Without DYMO Connect Service
- Info message: "DYMO Connect service not running"
- Subtitle: "Ensure DYMO Connect is running for direct printing"
- Falls back to browser print dialog
- Still fully functional, just less convenient

## Label Format

The integration uses DYMO's 30252 Address label format (2.25" x 1.125"):
- **Left side**: Whiskey details
  - Name (bold, larger font)
  - Distillery
  - Proof, location, rating
- **Right side**: QR code with barcode text

## Benefits Over Browser Printing

1. **No Print Dialog**: Labels print immediately
2. **Better Formatting**: Uses DYMO's native label formatting
3. **Multiple Labels**: Batch printing is seamless
4. **Consistent Output**: No browser-specific print quirks
5. **Web Service Based**: No SDK installation required

## Troubleshooting

### Printer Not Detected
1. Ensure DYMO Connect software is installed and running
2. Check that DYMO Connect Web Service is active (HTTPS on port 41951)
3. Check printer is connected and powered on
4. Refresh the page after connecting printer
5. Try restarting DYMO Connect software
6. If you see certificate warnings, this is normal - DYMO uses a self-signed certificate

### Labels Not Printing
1. Check printer has labels loaded
2. Verify correct label type (30252)
3. Check printer status in DYMO Connect
4. Try printing a test label from DYMO Connect

### Port 41951 / HTTPS Access
- DYMO Connect Web Service runs on HTTPS (not HTTP)
- Uses a self-signed certificate which may trigger browser warnings
- The service URL is `https://127.0.0.1:41951`
- If you see security warnings about the certificate, this is normal and expected

## Technical Details

The integration uses:
- DYMO Connect Web Service Framework
- Local HTTPS web service on port 41951 (with self-signed certificate)
- XML-based label templates
- Dynamic printer detection via web service
- Graceful fallback to browser printing
- No server-side installation required
- Fallback to GitHub-hosted framework if local service unavailable