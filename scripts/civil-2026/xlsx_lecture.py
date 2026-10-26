import zipfile, re, json, sys
import xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col(c):
    n=0
    for ch in re.match(r'[A-Z]+',c).group(): n=n*26+ord(ch)-64
    return n-1
def read(f):
    z=zipfile.ZipFile(f)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rmap={r.get('Id'):r.get('Target') for r in rels}
    out={}
    for s in wb.find('m:sheets',NS):
        t=rmap[s.get('{%s}id'%NS['r'])]; t=t.lstrip('/'); t=t if t.startswith('xl/') else 'xl/'+t
        rows=[]
        for row in ET.fromstring(z.read(t)).iter('{%s}row'%NS['m']):
            r={}
            for c in row.findall('m:c',NS):
                v=c.find('m:v',NS); typ=c.get('t')
                if typ=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                elif v is None: continue
                elif typ=='s': val=ss[int(v.text)]
                else: val=v.text
                r[col(c.get('r'))]=val
            if r: rows.append([r.get(i) for i in range(max(r)+1)])
        out[s.get('name')]=rows
    return out
if __name__=='__main__':
    for f in sys.argv[1:]:
        d=read(f); print('=====',f)
        for k,rows in d.items():
            print('--',k,'lignes:',len(rows)-1)
            for r in rows[:3]: print('   ',r)
