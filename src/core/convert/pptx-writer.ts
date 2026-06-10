/**
 * Minimal native PPTX writer over JSZip: one full-bleed image per slide
 * (PDF page renders → PowerPoint deck). Includes the required master/layout/
 * theme skeleton so output opens cleanly in PowerPoint and LibreOffice.
 */
import JSZip from 'jszip';

export interface SlideImage {
  pngBytes: Uint8Array;
  /** Page size in PDF points — determines slide dimensions. */
  widthPt: number;
  heightPt: number;
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const EMU_PER_PT = 12700;

const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
};

function slideXml(cx: number, cy: number): string {
  return (
    XML_DECL +
    `<p:sld xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}"><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '<p:pic><p:nvPicPr><p:cNvPr id="2" name="Page image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>' +
    '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>' +
    '</p:spTree></p:cSld></p:sld>'
  );
}

const themeXml =
  XML_DECL +
  `<a:theme xmlns:a="${NS.a}" name="Vikings"><a:themeElements>` +
  '<a:clrScheme name="Vikings"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
  '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="1F2A44"/></a:dk2><a:lt2><a:srgbClr val="EEF1F6"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="3B82F6"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="107C10"/></a:accent3><a:accent4><a:srgbClr val="D13438"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="605E5C"/></a:accent5><a:accent6><a:srgbClr val="8961D6"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="8961D6"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="Vikings"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
  '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
  '<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
  '<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
  '<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
  '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
  '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>' +
  '</a:fmtScheme></a:themeElements></a:theme>';

function slideMasterXml(): string {
  return (
    XML_DECL +
    `<p:sldMaster xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}"><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr/></p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '</p:sldMaster>'
  );
}

function slideLayoutXml(): string {
  return (
    XML_DECL +
    `<p:sldLayout xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}" type="blank"><p:cSld name="Blank"><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr/></p:spTree></p:cSld>' +
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'
  );
}

export async function buildPptx(slides: SlideImage[]): Promise<Uint8Array> {
  if (slides.length === 0) throw new Error('No slides to write');
  const zip = new JSZip();
  const first = slides[0]!;
  const cx = Math.round(first.widthPt * EMU_PER_PT);
  const cy = Math.round(first.heightPt * EMU_PER_PT);

  zip.file(
    '[Content_Types].xml',
    XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
      slides
        .map(
          (_, i) =>
            `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
        )
        .join('') +
      '</Types>'
  );

  zip.file(
    '_rels/.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
      '</Relationships>'
  );

  zip.file(
    'ppt/presentation.xml',
    XML_DECL +
      `<p:presentation xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}">` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst>' +
      slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('') +
      '</p:sldIdLst>' +
      `<p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="${cy}" cy="${cx}"/>` +
      '</p:presentation>'
  );

  zip.file(
    'ppt/_rels/presentation.xml.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
      slides
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
        )
        .join('') +
      '</Relationships>'
  );

  zip.file('ppt/theme/theme1.xml', themeXml);
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml());
  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
      '</Relationships>'
  );
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml());
  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
      '</Relationships>'
  );

  slides.forEach((slide, i) => {
    const scx = Math.round(slide.widthPt * EMU_PER_PT);
    const scy = Math.round(slide.heightPt * EMU_PER_PT);
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(scx, scy));
    zip.file(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      XML_DECL +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.png"/>` +
        '</Relationships>'
    );
    zip.file(`ppt/media/image${i + 1}.png`, slide.pngBytes);
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
