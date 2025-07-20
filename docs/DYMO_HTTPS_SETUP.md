# DYMO Connect HTTPS Setup Guide

## Important: DYMO Connect Uses HTTPS with Self-Signed Certificate

DYMO Connect Web Service runs on HTTPS at `https://127.0.0.1:41951` with a self-signed certificate.

## Solution: Use GitHub-Hosted Framework

Browsers block direct access to the DYMO service due to the self-signed certificate. The solution is to:
1. Load the DYMO framework from GitHub
2. Let the framework handle the HTTPS connection internally
3. Never use fetch() to call DYMO APIs directly

## Implementation Details

### Loading the Framework
```javascript
// Load framework from GitHub to bypass certificate issues
const script = document.createElement('script');
script.src = 'https://raw.githubusercontent.com/dymosoftware/dymo-connect-framework/master/dymo.connect.framework.js';

script.onload = () => {
  console.log('DYMO framework loaded from GitHub');
  if (window.dymo && window.dymo.connect) {
    // Framework will handle the HTTPS connection internally
    checkDymoPrinters();
  }
};
```

### Checking for Printers
```javascript
// Let the framework handle the HTTPS connection
const printers = await window.dymo.connect.framework.getPrinters();
console.log('DYMO printers found:', printers);

// Note: IsConnected might be False if printer is off/disconnected
const labelWriter = printers.find(p => p.printerType === 'LabelWriterPrinter');
```

## Mixed Content Issues

If your Next.js app runs on HTTP (default), browsers may block HTTPS requests to DYMO.

### Option 1: Run Next.js with HTTPS (Recommended)
```bash
# Install local certificate tool
npm install -g mkcert

# Create local certificates
mkcert -install
mkcert localhost

# Create a custom server script
```

### Option 2: Use Production Build
```bash
npm run build
npm run start
```

### Option 3: Browser Settings
- Chrome: Allow insecure content for localhost
- Settings → Privacy and security → Site Settings → Insecure content → Add [*.]localhost

## Verifying DYMO Connection

1. **Test with curl (bypasses browser restrictions)**
   ```bash
   curl -v https://127.0.0.1:41951/DYMO/DLS/Printing/GetPrinters
   ```
   Should return XML with your printer details

2. **Check Framework Loading**
   Open browser console and look for:
   - "DYMO framework loaded from GitHub"
   - "DYMO printers found: [...]"

3. **Check Printer Status**
   Console should show your printer:
   - Name: "DYMO LabelWriter 450 Turbo" (or your model)
   - IsConnected: true/false (false means printer is off or USB disconnected)

## Troubleshooting

### Printer Shows "IsConnected: False"
This is common and means:
- Printer is turned off
- USB cable is disconnected
- Driver issue
- **Solution**: Turn on the printer and ensure USB is connected

### Framework Won't Load
1. Ensure DYMO Connect software is running
2. Check if service is up: `curl https://127.0.0.1:41951/DYMO/DLS/Printing/StatusConnected`
3. Framework is loaded from GitHub, so internet connection is required

### No Printers Found
1. DYMO Connect software must be running
2. Printer must be connected and powered on
3. Try restarting DYMO Connect software
4. Check Windows Printers & Scanners / macOS Printers & Scanners

### Key Points
- **DO NOT** use fetch() to call DYMO APIs directly
- **DO** let the DYMO framework handle all HTTPS connections
- The framework knows how to bypass the certificate issues internally

## Security Note

The self-signed certificate is only for local communication between your browser and the DYMO service on your computer. This is secure because:
- Communication never leaves your machine
- Only accessible from localhost/127.0.0.1
- Cannot be accessed from external networks