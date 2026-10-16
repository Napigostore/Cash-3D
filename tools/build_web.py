"""Builds the web game for the iOS app from web/dong-tien-3d.html:
    ios/CashToFreedom/www/vi.html   Vietnamese original (VND)
    ios/CashToFreedom/www/en.html   English, international setting, prices shown in USD (2,500 VND = $1)
    ios/CashToFreedom/www/three.min.js
Run: python tools/build_web.py   (prints any Vietnamese text left untranslated in the English build)
"""
import json
import os
import re
import shutil
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'web', 'dong-tien-3d.html')
OUT = os.path.join(ROOT, 'ios', 'CashToFreedom', 'www')
EN_DIR = os.path.join(ROOT, 'tools', 'en')

L = r"A-Za-z0-9À-ỹ"
PHRASE = re.compile(rf"[{L}][{L} .,:!?…–%“”’\-]*[{L}.!?…”%]|[{L}]+")
VN = re.compile(r"[À-ỹ]")
THREE_CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
USD = 2500
# The game file is a body fragment (as published on claude.ai); the app needs a full document.
SKELETON = ('<!doctype html><html lang="vi"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
            '<style>html,body{margin:0;background:#0b1220;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}#onlineBtn{display:none!important}</style></head>\n')

# Exact source snippets swapped before the phrase pass (multi-word tile labels, number formatting, locale).
PRE = [
    ("function trimNum(v,d){let t=num(v).toFixed(d);if(t.includes('.'))t=t.replace(/0+$/,'').replace(/\\.$/,'');return t.replace('.',',');}",
     "function trimNum(v,d){let t=num(v).toFixed(d);if(t.includes('.'))t=t.replace(/0+$/,'').replace(/\\.$/,'');return t;}"),
    ("""function fmt(n){n=num(n);const s=n<0?'-':'';n=Math.abs(Math.round(n));
  if(n>=TY)return s+trimNum(n/TY,2)+' tỷ';
  if(n>=TR)return s+trimNum(n/TR,n>=1e7?1:2)+' tr';
  if(n>=1e3)return s+trimNum(n/1e3,0)+'k';
  return s+n+'đ';}
const fmtD=n=>Math.round(num(n)).toLocaleString('vi-VN')+'đ';""",
     f"""const USD={USD};
function fmt(n){{n=num(n)/USD;const s=n<0?'-$':'$';n=Math.abs(n);
  if(n>=1e9)return s+trimNum(n/1e9,2)+'B';
  if(n>=1e6)return s+trimNum(n/1e6,n>=1e7?1:2)+'M';
  if(n>=1e4)return s+trimNum(n/1e3,n>=1e5?0:1)+'k';
  return s+Math.round(n).toLocaleString('en-US');}}
const fmtD=n=>'$'+(num(n)/USD).toLocaleString('en-US',{{minimumFractionDigits:2,maximumFractionDigits:2}});"""),
    ("lines:['THỊ','TRƯỜNG']", "lines:['MARKET']"),
    ("lines:['TIÊU','XÀI']", "lines:['DOODAD']"),
    ("lines:['THỜI GIAN','RẢNH']", "lines:['FREE','TIME']"),
    ("lines:['THƯỞNG','GIỮA NĂM']", "lines:['MID-YEAR','BONUS']"),
    ("lines:['THƯỞNG','TẾT']", "lines:['YEAR-END','BONUS']"),
    ("lines:['TỪ','THIỆN']", "lines:['CHARITY']"),
    ("lines:['MẤT','VIỆC']", "lines:['LAID','OFF']"),
    ("lines:['NGÀY','LĨNH LƯƠNG']", "lines:['PAYDAY']"),
    ("lines:['KIỂM TOÁN','THUẾ']", "lines:['TAX','AUDIT']"),
    ("lines:['LƯƠNG']", "lines:['PAYDAY']"),
    ("lines:['EM BÉ']", "lines:['BABY']"),
    ("lines:['CƠ HỘI']", "lines:['DEAL']"),
    ("lines:['CÔNG NGHỆ','MỚI']", "lines:['NEW','TECH']"),
    ("lines:['LUẬT','MỚI']", "lines:['NEW','LAW']"),
    ("lines:['KHỦNG','HOẢNG']", "lines:['MARKET','CRASH']"),
    ("lines:['ĐỐI TÁC','GIAN LẬN']", "lines:['PARTNER','FRAUD']"),
    ("lines:['KHU CÔNG','NGHIỆP']", "lines:['INDUSTRIAL','PARK']"),
    ("lines:['SÂN','GÔN']", "lines:['GOLF']"),
    ("lines:['THANH','TRA']", "lines:['INSPEC-','TION']"),
    ("lines:['BỊ KIỆN']", "lines:['LAWSUIT']"),
    ("lines:['LY HÔN']", "lines:['DIVORCE']"),
    ("toLocaleString('vi-VN')", "toLocaleString('en-US')"),
]

# Plain-ASCII strings (no diacritics, so the phrase pass misses them) and parody brands, applied after it.
POST = [
    (r'\bVNMA\b', 'NUTR'), (r'\bFPTA\b', 'CODX'), (r'\bVCBA\b', 'UNIB'), (r'\bHPGA\b', 'IRON'),
    (r'\bMWGA\b', 'MEGA'), (r'\bGASA\b', 'PGAS'), (r'\bSSIA\b', 'BRKR'), (r'\bDBX\b', 'HYPE'),
    (r'Vinama', 'Nutrava'), (r'FaPaTa', 'Codexa'), (r'Vietcombang', 'Unibanc'), (r'PV Gaz', 'Petra Gas'),
    (r'\bSaSi\b', 'Brokera'), (r'VN-Index', 'Global index'),
    (r'VANHOME SMART CATY', 'SKYLINE SMART CITY'), (r'VANHOME OCEAN PAK', 'HARBOR VIEW LOFTS'),
    (r'VANHOME GRAND PAK', 'GRAND PARK RESIDENCES'), (r'Vanhome Grand Pak', 'Grand Park Residences'),
    (r'Vanhome Ocean Pak', 'Harbor View Lofts'), (r'Vanhome Smart Caty', 'Skyline Smart City'),
    (r'ECAPARK', 'ECOVALE'), (r'Ecapark|Ecopark', 'Ecovale'), (r'TIME CATY', 'TEMPO CITY'),
    (r'Time Caty|Times City', 'Tempo City'), (r'Cash 3D', 'Cash to Freedom'), (r"'₫'", "'$'"),
    (r"(\$\{[^}]*\}) cp\b", r'\1 sh'), (r"' cp'", "' sh'"),
    # The gold unit (chỉ) is also the word "only".
    (r"\}/only`", "}/coin`"), (r"/only</small>", "/coin</small>"), (r"\} only`", "} coins`"),
]
# Leftover fragments split around ASCII-only Vietnamese words: exact text swaps after everything else.
LIT = [
    ("/cp`", "/sh`"), ("Thu mua ${", "Buying ${"), ("'+13 tr/monthly payments", "'+$5,200 monthly payments"),
    ("} con`", "} kids`"), ("} con.`", "} kids.`"), ("(doanh thu > 100 tr/year)", "(revenue > $40,000/year)"),
    ("+5 tr'", "+$2,000'"), ("Spouse’s salary/spouse", "Spouse’s salary"), (", vay ${", ", loan ${"),
    ("'Cao'", "'High'"), ("{n:'Cam',", "{n:'Orange',"), ("{n:'Lam',", "{n:'Blue',"), ("{n:'Gold',c:'#fd", "{n:'Yellow',c:'#fd"),
    ("'Mua xe 700 tr, vay 80%", "'Buy a luxury SUV ($280k), 80% loan"), ("'Mua xe 900 tr, vay 70%", "'Buy a luxury SUV ($360k), 70% loan"),
    ("'the kids':'con'}", "'the kids':'your child'}"), ("'Chi '+fmt", "'Costs '+fmt"), ("</b> cho <b>", "</b> for <b>"),
    ("`Sau ${", "`After ${"), ("'Kinh doanh", "'Business"), (">Xem</button>", ">View</button>"), ("`Mua ", "`Buy "),
    ("`Vay ${pct", "`Borrow ${pct"), ("'NHA KHOA'", "'DENTIST'"), ("'MUA'", "'BUY'"), ("'KCN'", "'FACTORY'"),
    ("'TRUY THU'", "'BACK TAX'"), ("'anh Khoa'", "'Chris'"),
    ("x.fillText('CASH',w/2,h*.47);x.fillText('MONEY',w/2,h*.63);", "x.font='800 118px \"Bricolage Grotesque\",sans-serif';x.fillText('CASH TO',w/2,h*.47);x.fillText('FREEDOM',w/2,h*.63);"),
    ("y/o · TS ${", "y/o · NW ${"), ("</b>/months of passive income to reach", "</b>/month of passive income to reach"),
    ("0,01 BTC", "0.01 BTC"), ("Prosperity Track · Thanh tra'", "Prosperity Track · Inspection'"), ("VN-INDEX", "INDEX"), ("Cash to Freedom<em> 3D</em>", "Cash to <em>Freedom</em>"), ("/cp ·", "/sh ·"),
]


def load_map():
    vn = [l.split('\t', 1)[1] for l in open(os.path.join(ROOT, 'tools', 'vn_phrases.txt'), encoding='utf-8').read().splitlines()]
    en = [''] * len(vn)
    extra = {}
    for name in os.listdir(EN_DIR):
        if name == 'extra.tsv':
            # Phrases added after the first translation pass: "Vietnamese<TAB>English" per line.
            for l in open(os.path.join(EN_DIR, name), encoding='utf-8').read().splitlines():
                if '	' in l:
                    k, v = l.split('	', 1)
                    extra[k] = v
            continue
        start = int(name.split('.')[0])
        lines = open(os.path.join(EN_DIR, name), encoding='utf-8').read().splitlines()
        if name.endswith('.tsv'):
            for l in lines:
                i, t = l.split('\t', 1)
                en[int(i)] = t
        else:
            for k, t in enumerate(lines):
                en[start + k] = t
    missing = [vn[i] for i, t in enumerate(en) if not t]
    if missing:
        sys.exit(f'{len(missing)} phrases have no translation, e.g. {missing[:5]}')
    # Translations land inside '…', "…" and `…` strings: use typographic quotes so none of them break.
    def typo(t):
        t = t.replace("'", '’')
        parts = t.split('"')
        return ''.join(p + ('“' if i % 2 == 0 else '”') for i, p in enumerate(parts[:-1])) + parts[-1]
    table = dict(zip(vn, [typo(t) for t in en]))
    table.update({k: typo(v) for k, v in extra.items()})
    return table


def english(html):
    for a, b in PRE:
        if a not in html:
            sys.exit('Source changed, cannot find: ' + a[:80])
        html = html.replace(a, b)
    table = load_map()
    left = set()

    def swap(m):
        s = m.group(0)
        if not VN.search(s):
            return s
        if s in table:
            return table[s]
        left.add(s)
        return s
    # Leave comments untouched: they don't reach the player.
    parts = re.split(r'(/\*.*?\*/|(?<![:\'"`\\])//[^\n]*)', html, flags=re.S)
    html = ''.join(p if i % 2 else PHRASE.sub(swap, p) for i, p in enumerate(parts))
    for a, b in POST:
        html = re.sub(a, b, html)
    for a, b in LIT:
        if a not in html:
            print('  (literal not found: ' + a + ')')
        html = html.replace(a, b)
    return html, left


# Screenshot mode: the app opens <lang>.html#demo-<screen> when launched with "-demo <screen>".
# Each launch starts from a clean slate and drives the setup screen like a player would.
DEMO_RESET = """<script>if(location.hash.indexOf('#demo-')===0){try{localStorage.clear()}catch(e){}}</script>\n"""
DEMO_DRIVE = """<script>
(async function(){const m=location.hash.match(/^#demo-(\\w+)/);if(!m)return;const k=m[1];
  const wait=ms=>new Promise(r=>setTimeout(r,ms)),click=s=>{const b=document.querySelector(s);if(b)b.click();return !!b;};
  await wait(3000);if(k==='home')return;
  click('[data-n="4"]');await wait(300);click(k==='ledger'?'[data-quiz="1"]':'[data-quiz="0"]');await wait(300);
  click('#startBtn');await wait(3500);
  if(k==='deal'){showDeal(curP(),drawBig());}
  else if(k==='statement'){showStatement(curP());}
  else if(k==='rules'){showRules();}
})();
</script>
"""


def lang_button(html, to, label):
    """Top-bar button that switches language. In the iOS app the native side remembers the choice and reloads."""
    anchor = '<div id="rank"></div></header>'
    if anchor not in html:
        sys.exit('top bar not found')
    button = (f'<button class="iconbtn" id="langBtn" title="{label}" aria-label="{label}" style="font-size:11px;font-weight:800" '
              f'onclick="const h=window.webkit&&webkit.messageHandlers&&webkit.messageHandlers.lang;'
              f'if(h)h.postMessage(\'{to}\');else location.href=\'{to}.html\'">{to.upper()}</button>')
    html = html.replace(anchor, button + anchor)
    head_end = html.index('</head>') + len('</head>\n')
    return html[:head_end] + DEMO_RESET + html[head_end:] + DEMO_DRIVE


def main():
    src = open(SRC, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    os.makedirs(OUT, exist_ok=True)
    local = SKELETON + src.replace(THREE_CDN, '<script src="three.min.js"></script>')
    if local == src:
        sys.exit('three.js CDN tag not found')
    open(os.path.join(OUT, 'vi.html'), 'w', encoding='utf-8').write(lang_button(local, 'en', 'English'))
    en, left = english(local.replace('<html lang="vi">', '<html lang="en">'))
    en = lang_button(en, 'vi', 'Tiếng Việt')
    open(os.path.join(OUT, 'en.html'), 'w', encoding='utf-8').write(en)
    shutil.copy(os.path.join(ROOT, 'web', 'three.min.js'), os.path.join(OUT, 'three.min.js'))
    print('built', OUT, '| untranslated:', len(left))
    for s in sorted(left):
        print('  ', s)


if __name__ == '__main__':
    main()
