import urllib.request
import urllib.parse
import re
import os
import ssl
import time

ssl._create_default_https_context = ssl._create_unverified_context

assets_dir = "assets"

# 6 emperors whose images are broken (12110 bytes = baidu error placeholder)
targets = [
    ("chenshubao", ["陈叔宝", "陈后主"]),
    ("liubang",    ["刘邦", "汉高祖"]),
    ("simayan",    ["司马炎", "晋武帝"]),
    ("yeludeguang",["耶律德光", "辽太宗"]),
    ("zhuhoucong", ["朱厚熜", "嘉靖帝", "明世宗"]),
    ("zhuyoujian", ["朱由检", "崇祯帝", "明思宗"]),
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://baike.baidu.com/',
}

def try_baidu(name):
    encoded = urllib.parse.quote(name)
    url = f"https://baike.baidu.com/item/{encoded}"
    print(f"    GET {url}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"    Request failed: {e}")
        return None

    # Try og:image first
    og = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if og:
        img = og.group(1)
        if img.startswith('//'): img = 'https:' + img
        print(f"    Found og:image: {img[:80]}")
        return img

    # Try bkimg CDN directly
    img = re.search(r'"(https://bkimg\.cdn\.bcebos\.com/pic/[^"?]+)"', html)
    if img:
        print(f"    Found bkimg: {img.group(1)[:80]}")
        return img.group(1)

    # Try any jpg/png from bkimg
    img = re.search(r'(https://bkimg[^\s"\']+\.(?:jpg|jpeg|png))', html)
    if img:
        print(f"    Found fallback img: {img.group(1)[:80]}")
        return img.group(1)

    print(f"    No image found in HTML (len={len(html)})")
    return None

def download_img(url, out_path):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = resp.read()
    if len(data) <= 15000:
        print(f"    Too small ({len(data)} bytes) - likely placeholder, skipping")
        return False
    with open(out_path, 'wb') as f:
        f.write(data)
    print(f"    Saved {out_path} ({len(data)//1024} KB)")
    return True

for eid, names in targets:
    out = os.path.join(assets_dir, f"{eid}.jpg")
    print(f"\n[{eid}]")
    success = False
    for name in names:
        img_url = try_baidu(name)
        if img_url:
            try:
                ok = download_img(img_url, out)
                if ok:
                    success = True
                    break
            except Exception as e:
                print(f"    Download error: {e}")
        time.sleep(1.5)
    if not success:
        print(f"  FAILED all attempts for {eid}")

print("\nDone!")
