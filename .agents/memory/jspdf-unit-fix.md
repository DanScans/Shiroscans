---
name: jsPDF unit fix
description: Using unit:"px" in jsPDF causes black bars (wrong aspect ratio) in PDF output; must use unit:"pt" with explicit px-to-pt conversion.
---

## Rule
When creating PDFs with jsPDF from canvas image data, always use `unit: "pt"` and convert pixel dimensions to points explicitly. Never use `unit: "px"`.

**Why:** jsPDF's `unit: "px"` has inconsistent internal handling that causes the page size and image placement to disagree, producing black bars (letterboxing) on the sides of pages. With `unit: "pt"`, dimensions are unambiguous.

**How to apply:**
```javascript
const wPt = img.naturalWidth * 0.75;   // 1px = 72/96pt = 0.75pt
const hPt = img.naturalHeight * 0.75;
// White background to prevent transparency artifacts
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, w, h);
ctx.drawImage(img, 0, 0, w, h);
const dataUrl = canvas.toDataURL("image/jpeg", 0.95);  // high quality
if (!pdf) {
  pdf = new jsPDF({ orientation: hPt >= wPt ? "portrait" : "landscape", unit: "pt", format: [wPt, hPt], compress: true });
} else {
  pdf.addPage([wPt, hPt], hPt >= wPt ? "portrait" : "landscape");
}
pdf.addImage(dataUrl, "JPEG", 0, 0, wPt, hPt);
```
