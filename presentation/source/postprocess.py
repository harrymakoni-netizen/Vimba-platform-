"""Post-process the pptxgenjs output so it matches the original deck's structure.

1. Pictures named ROUND:<radius_in>:<name> get rounded-rectangle geometry.
2. The text box named "Title" on each slide becomes the slide's title placeholder
   (explicit position, size and colour stay on the shape, exactly like the original).

pptxgenjs only writes rect or ellipse geometry for pictures, so the radius is carried in the
object name and applied here. Usage: python3 postprocess.py deck.pptx
"""
import re
import sys
import zipfile
import shutil
import tempfile

EMU = 914400


def fix_pic(m: re.Match) -> str:
    pic = m.group(0)
    nm = re.search(r'name="ROUND:([0-9.]+):([^"]*)"', pic)
    if not nm:
        return pic
    radius = float(nm.group(1))
    ext = re.search(r'<a:ext cx="(\d+)" cy="(\d+)"\s*/>', pic)
    cx, cy = int(ext.group(1)), int(ext.group(2))
    adj = round(radius * EMU * 100000 / min(cx, cy))
    pic = pic.replace(nm.group(0), f'name="{nm.group(2)}"')
    new_geom = f'<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val {adj}"/></a:avLst></a:prstGeom>'
    pic, n = re.subn(r'<a:prstGeom prst="rect">\s*<a:avLst\s*/>\s*</a:prstGeom>', new_geom, pic, count=1)
    if n != 1:
        raise SystemExit('could not find picture geometry to round')
    return pic


def main(path: str) -> None:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pptx').name
    count = 0
    titles = 0
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if re.match(r'ppt/slides/slide\d+\.xml$', info.filename):
                xml = data.decode('utf-8')
                before = xml.count('ROUND:')
                xml = re.sub(r'<p:pic>.*?</p:pic>', fix_pic, xml, flags=re.S)
                if 'ROUND:' in xml:
                    raise SystemExit(f'unprocessed ROUND marker in {info.filename}')
                count += before
                xml, n = re.subn(r'(<p:sp><p:nvSpPr><p:cNvPr id="\d+" name="Title"\s*>\s*</p:cNvPr><p:cNvSpPr/>)<p:nvPr>\s*</p:nvPr>',
                                 r'\1<p:nvPr><p:ph type="title"/></p:nvPr>', xml)
                if n != 1:
                    raise SystemExit(f'{info.filename}: expected exactly one Title shape, found {n}')
                titles += 1
                data = xml.encode('utf-8')
            zout.writestr(info, data)
    shutil.move(tmp, path)
    print(f'rounded {count} pictures, marked {titles} title placeholders in {path}')


if __name__ == '__main__':
    main(sys.argv[1])
