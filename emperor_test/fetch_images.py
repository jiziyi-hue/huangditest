import urllib.request
import urllib.parse
import re
import os
import ssl
import time

ssl._create_default_https_context = ssl._create_unverified_context

# Retry with different search terms
missing = [
    ("liuxin", "汉哀帝"),
    ("zhuyunwen", "朱允炆"),
]

assets_dir = "assets"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

def fetch_baidu_image(name):
    encoded_name = urllib.parse.quote(name)
    url = f"https://baike.baidu.com/item/{encoded_name}"
    print(f"  Trying URL: {url}")
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    og = re.search(r'<meta property="og:image" content="([^"]+)"', html)
    if og:
        img_url = og.group(1)
        if img_url.startswith('//'):
            img_url = 'https:' + img_url
        return img_url
    
    img = re.search(r'src="(https://bkimg\.cdn\.bcebos\.com/pic/[^"]+)"', html)
    if img:
        return img.group(1)
    
    img = re.search(r'"(https?://bkimg[^"]+\.(?:jpg|png|jpeg))"', html)
    if img:
        return img.group(1)
    
    return None

for eid, name in missing:
    output_path = os.path.join(assets_dir, f"{eid}.jpg")
    if os.path.exists(output_path):
        print(f"Already have: {name}")
        continue
    
    try:
        print(f"Fetching {name}...")
        img_url = fetch_baidu_image(name)
        
        if img_url:
            img_req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(img_req, timeout=10) as img_resp:
                data = img_resp.read()
                with open(output_path, 'wb') as f:
                    f.write(data)
            print(f"  -> Saved {output_path} ({len(data)//1024} KB)")
        else:
            print(f"  -> No image found for {name}")
    except Exception as e:
        print(f"  -> Error for {name}: {e}")
    
    time.sleep(1.2)

print("Done!")
