# DYMO Label XML Format Requirements

## Critical: No Self-Closing Tags!

DYMO Connect Framework **cannot parse self-closing XML tags**. This is the most common cause of blank labels.

### ❌ WRONG (Self-closing tags)
```xml
<ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
<Font Family="Arial" Size="12" Bold="True" />
<RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270" />
```

### ✅ CORRECT (Full closing tags)
```xml
<ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
<Font Family="Arial" Size="12" Bold="True" Italic="False" Underline="False" Strikeout="False"></Font>
<RoundRectangle X="0" Y="0" Width="1581" Height="5040" Rx="270" Ry="270"></RoundRectangle>
```

## Required XML Structure

### 1. Document Declaration
```xml
<?xml version="1.0" encoding="utf-8"?>
```

### 2. Label Definition
```xml
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
```

### 3. Text Objects
Every text element must include:
- Full closing tags for ALL elements
- Complete Font attributes (Bold, Italic, Underline, Strikeout)
- ForeColor in both TextObject AND Attributes

```xml
<TextObject>
  <Name>BottleName</Name>
  <ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
  <BackColor Alpha="0" Red="255" Green="255" Blue="255"></BackColor>
  <StyledText>
    <Element>
      <String>${bottleName}</String>
      <Attributes>
        <Font Family="Arial" Size="12" Bold="True" Italic="False" Underline="False" Strikeout="False"></Font>
        <ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
      </Attributes>
    </Element>
  </StyledText>
</TextObject>
```

### 4. QR Code Objects
```xml
<BarcodeObject>
  <Name>Barcode</Name>
  <ForeColor Alpha="255" Red="0" Green="0" Blue="0"></ForeColor>
  <BackColor Alpha="0" Red="255" Green="255" Blue="255"></BackColor>
  <Type>QRCode</Type>
  <Size>Small</Size>
  <TextPosition>None</TextPosition>
  <ECLevel>0</ECLevel>
  <QuietZonesPadding Left="0" Right="0" Top="0" Bottom="0"></QuietZonesPadding>
</BarcodeObject>
```

### 5. Object Positioning
Use Bounds to position objects on the label:
```xml
<Bounds X="332" Y="180" Width="2880" Height="720"></Bounds>
```

## Common Issues

### Blank Labels
1. **Self-closing tags** - Most common issue
2. **Missing required attributes** - Font needs all 5 attributes
3. **Incorrect Bounds** - Objects positioned off the label
4. **Empty String elements** - Ensure text content exists

### XML Parsing Errors
1. **Special characters** - Escape &, <, > in text
2. **Line breaks** - Use \n for newlines in String elements
3. **Encoding issues** - Always use UTF-8

## Debugging Tips

1. **Check Console Logs**
   - Look for XML parsing errors
   - Verify DYMO Connect service is running

2. **Test with Simple Label**
   - Start with just one text object
   - Add complexity gradually

3. **Validate XML**
   - Ensure all tags have closing tags
   - Check attribute quotes are proper

4. **Print Window Behavior**
   - Chrome print dialog opening is CORRECT
   - Users select their DYMO printer there
   - Blank preview = XML format issue

## Working Example
See the `getDymoLabelXml()` function in:
- `/app/bottles/[id]/label/page.tsx`
- `/app/labels/LabelsContent.tsx`

These contain properly formatted XML that DYMO Connect can parse.