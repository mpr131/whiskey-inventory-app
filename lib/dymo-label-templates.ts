// DYMO Label Templates - Similar to CellarTracker's approach
// Each template is properly formatted for the specific label size

export interface LabelData {
  name: string;
  distillery: string;
  age?: string | number;  // "15 Year" or just 15
  proof?: number;
  barcode: string;
  rating?: number;
  // Optional fields
  price?: number | string;
  store?: string;
  location?: {
    area: string;
    bin?: string;
  };
}

export type DymoLabelSize = '30252' | '30336' | '30334' | '30256' | '30330';

export const DYMO_LABEL_INFO: Record<DymoLabelSize, { 
  name: string; 
  width: number; // in twips (1/20 of a point, 1440 twips = 1 inch)
  height: number; 
}> = {
  '30252': { 
    name: 'Address (1-1/8" × 3-1/2")', 
    width: 5040,  // 3.5 inches
    height: 1620  // 1.125 inches
  },
  '30336': { 
    name: 'Multi-Purpose (1" × 2-1/8")', 
    width: 3060,  // 2.125 inches
    height: 1440  // 1 inch
  },
  '30334': { 
    name: 'Medium (2-1/4" × 1-1/4")', 
    width: 3240,  // 2.25 inches
    height: 1800  // 1.25 inches
  },
  '30256': { 
    name: 'Large (2-5/16" × 4")', 
    width: 5760,  // 4 inches
    height: 3330  // 2.3125 inches
  },
  '30330': { 
    name: 'Return Address (3/4" × 2")', 
    width: 2880,  // 2 inches
    height: 1080  // 0.75 inches
  }
};

export function generateDymoLabelXml(labelSize: DymoLabelSize, data: LabelData): string {
  const labelInfo = DYMO_LABEL_INFO[labelSize];
  
  // Build the text content
  const textLines: string[] = [];
  textLines.push(data.name);
  textLines.push(data.distillery);
  
  if (data.proof) {
    textLines.push(`${data.proof}° proof`);
  }
  
  if (data.location) {
    const locationStr = data.location.area + (data.location.bin ? `-${data.location.bin}` : '');
    textLines.push(locationStr);
  }
  
  if (data.rating) {
    textLines.push(`t8ke: ${data.rating}/10`);
  }
  
  textLines.push(data.barcode);
  
  const textContent = textLines.join('\\n'); // Note: escaped newline for XML
  
  // Calculate font size based on label size
  let fontSize = 12;
  if (labelSize === '30336' || labelSize === '30330') {
    fontSize = 11; // Increased from 10 for better readability
  } else if (labelSize === '30256') {
    fontSize = 14;
  }
  
  // Use standard DYMO paper names
  const paperName = labelSize === '30252' ? '30252 Address' :
                    labelSize === '30336' ? '30336 1 in x 2-1/8 in' :
                    labelSize === '30334' ? '30334 2-1/4 in x 1-1/4 in' :
                    labelSize === '30256' ? '30256 Shipping' :
                    '30330 Return Address';
  
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>${paperName}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${labelInfo.width}" Height="${labelInfo.height}" Rx="270" Ry="270" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>TEXT</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Top</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${textContent}</String>
          <Attributes>
            <Font Family="Arial" Size="${fontSize}" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="72" Y="72" Width="${labelInfo.width - 144}" Height="${labelInfo.height - 144}" />
  </ObjectInfo>
</DieCutLabel>`;
}

// Template for labels with Code 128 barcodes
export function generateDymoLabelXmlWithBarcode(labelSize: DymoLabelSize, data: LabelData): string {
  const labelInfo = DYMO_LABEL_INFO[labelSize];
  
  // For Code 128 barcodes, we need to split the label into text and barcode sections
  const margin = 72; // 0.05 inch vertical margin
  const leftMargin = 350; // Large left margin to prevent text cutoff
  const rightMargin = 100; // Right margin
  
  // Calculate barcode dimensions - MUCH bigger for reliable scanning
  let barcodeHeight = 600; // Minimum 100px height for scanning
  let barcodeWidth = 1800; // Proportional width
  
  if (labelSize === '30336') {
    barcodeHeight = 500; // Good scanning height for small label
    barcodeWidth = 1600; // About 50% of label width
  } else if (labelSize === '30252' || labelSize === '30256') {
    barcodeHeight = 700; // Larger for bigger labels
    barcodeWidth = 2200; // Proportionally bigger
  }
  
  // Position barcode in bottom-right corner
  const barcodeX = labelInfo.width - barcodeWidth - margin; // Right-aligned with margin
  const barcodeY = labelInfo.height - barcodeHeight - margin; // Bottom-aligned with margin
  
  // Calculate text area - avoid overlap with barcode
  // Text can use the area above the barcode and to the left of it
  const textWidth = barcodeX - leftMargin - margin; // Stop where barcode starts
  const textHeight = labelInfo.height - (margin * 2); // Full height available
  
  // Build text lines - CORE fields always shown
  const textLines: string[] = [];
  textLines.push(data.name);
  textLines.push(data.distillery);
  if (data.age) textLines.push(`${data.age}${typeof data.age === 'number' ? ' Year' : ''}`);
  if (data.proof) textLines.push(`${data.proof}° proof`);
  
  // OPTIONAL fields
  if (data.price) textLines.push(`$${data.price}`);
  if (data.store) textLines.push(data.store);
  if (data.location) {
    textLines.push(data.location.area + (data.location.bin ? `-${data.location.bin}` : ''));
  }
  
  const textContent = textLines.join('\n');
  
  // Dynamic font sizing based on content
  let fontSize = 10;
  if (labelSize === '30336') {
    const lineCount = textLines.length;
    if (lineCount <= 4) fontSize = 10;      // Just core fields
    else if (lineCount <= 5) fontSize = 9;   // +1 optional field
    else if (lineCount <= 6) fontSize = 8;   // +2 optional fields
    else fontSize = 7;                       // All fields
  } else if (labelSize === '30252' || labelSize === '30256') {
    fontSize = 12;
  }
  
  // Use standard DYMO paper names
  const paperName = labelSize === '30252' ? '30252 Address' :
                    labelSize === '30336' ? '30336 1 in x 2-1/8 in' :
                    labelSize === '30334' ? '30334 2-1/4 in x 1-1/4 in' :
                    labelSize === '30256' ? '30256 Shipping' :
                    '30330 Return Address';
  
  return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>${paperName}</PaperName>
  <DrawCommands>
    <RoundRectangle X="0" Y="0" Width="${labelInfo.width}" Height="${labelInfo.height}" Rx="270" Ry="270" />
  </DrawCommands>
  <ObjectInfo>
    <TextObject>
      <Name>Text</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <HorizontalAlignment>Left</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>None</TextFitMode>
      <UseFullFontHeight>True</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String xml:space="preserve">${textContent}</String>
          <Attributes>
            <Font Family="Arial" Size="${fontSize}" Bold="False" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${leftMargin}" Y="${margin}" Width="${textWidth}" Height="${textHeight}" />
  </ObjectInfo>
  <ObjectInfo>
    <BarcodeObject>
      <Name>Barcode</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <GroupID>-1</GroupID>
      <IsOutlined>False</IsOutlined>
      <Text>${data.barcode}</Text>
      <Type>Code128Auto</Type>
      <Size>Medium</Size>
      <TextPosition>Bottom</TextPosition>
      <TextFont Family="Arial" Size="6" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <CheckSumFont Family="Arial" Size="6" Bold="False" Italic="False" Underline="False" Strikeout="False" />
      <TextEmbedding>None</TextEmbedding>
      <ECLevel>0</ECLevel>
      <HorizontalAlignment>Center</HorizontalAlignment>
      <QuietZonesPadding Left="0" Top="0" Right="0" Bottom="0" />
    </BarcodeObject>
    <Bounds X="${barcodeX}" Y="${barcodeY}" Width="${barcodeWidth}" Height="${barcodeHeight}" />
  </ObjectInfo>
</DieCutLabel>`;
}

// Export with old name for backward compatibility
export const generateDymoLabelXmlWithQR = generateDymoLabelXmlWithBarcode;