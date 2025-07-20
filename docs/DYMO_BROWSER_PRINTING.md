# DYMO Browser Label Printing

## Overview

The whiskey inventory app uses optimized HTML/CSS for DYMO label printing through the browser's standard print dialog. This approach avoids certificate issues and complex framework integration.

## How It Works

1. **Label Generation**: Labels are created as HTML with:
   - Optimized dimensions for DYMO LabelWriter (2.25" x 1.125")
   - Proper font sizes and spacing for small labels
   - QR codes generated with JavaScript
   - Automatic page breaks between labels

2. **Print Dialog**: Users select their DYMO printer from the browser's print dialog
   - Works with any DYMO LabelWriter model
   - No special software required (beyond DYMO drivers)
   - Same workflow as printing to any printer

3. **Features**:
   - Individual label printing (`/bottles/[id]/label`)
   - Batch label printing (`/labels`)
   - QR codes with vault barcodes
   - Smart batch selection (new, never printed, missing labels)
   - Print history tracking

## Label Format

### DYMO LabelWriter (2.25" x 1.125")
- **Content**: Whiskey name, distillery, proof, location, rating, QR code
- **Layout**: Horizontal with text on left, QR code on right
- **Font Sizes**: Optimized for readability on small labels

### Avery Labels
- **5160**: 1" x 2.625" (30 per sheet)
- **5163**: 2" x 4" (10 per sheet)
- **Grid Layout**: Automatic positioning for sheet labels

### Custom Sizes
- User-defined dimensions
- Same content as other formats

## Printing Instructions

1. **Select Label Format**: Choose DYMO, Avery, or Custom
2. **Click Print**: Opens print preview window
3. **Select Printer**: Choose your DYMO printer from the dialog
4. **Print Settings**:
   - Paper Size: Should auto-select based on label
   - Margins: Set to None or Minimum
   - Scale: 100% (no scaling)

## Benefits

- **No Certificate Issues**: Bypasses HTTPS/self-signed certificate problems
- **Universal Compatibility**: Works with all DYMO printers
- **Simple Implementation**: Just HTML/CSS, no complex frameworks
- **Reliable**: Uses standard browser printing
- **Cross-Platform**: Works on Windows, macOS, Linux

## Troubleshooting

### Labels Print Too Small/Large
- Check print dialog scale is set to 100%
- Verify correct label size is selected in printer settings

### Blank Labels
- Ensure pop-ups are allowed for the site
- Check that QR codes are generating (may take a moment)

### Multiple Labels Per Page
- For DYMO: Each label should print on its own
- For Avery: Labels arranged in grid automatically

## Technical Details

- Labels generated as HTML with inline styles
- QR codes created with qrcode.js library
- Print window opens with auto-print after QR generation
- Label dimensions precisely matched to physical labels