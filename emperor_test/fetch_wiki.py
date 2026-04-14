import urllib.request
import urllib.parse
import re
import os
import ssl
import json
import time

ssl._create_default_https_context = ssl._create_unverified_context

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
}

def fetch_wiki_thumb(title_zh, eid):
    """Use Wikipedia API to get page thumbnail"""
    encoded = urllib.parse.quote(title_zh)
    # Use zh.wikipedia.org API
    api_url = f"https://zh.wikipedia.org/api/rest_v1/page/summary/{encoded}"
    print(f"  Trying Wikipedia: {api_url}")
    req = urllib.request.Request(api_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        thumb = data.get('thumbnail', {}).get('source')
        if thumb:
            # Get larger version by replacing size
            thumb = re.sub(r'/\d+px-', '/400px-', thumb)
            print(f"  Found: {thumb[:80]}")
            return thumb
    except Exception as e:
        print(f"  Error: {e}")
    return None

def download_img(url, out_path):
    req = urllib.request.Request(url, headers={**headers, 'Referer': 'https://zh.wikipedia.org/'})
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = resp.read()
    if len(data) < 10000:
        print(f"  Too small ({len(data)} bytes)")
        return False
    with open(out_path, 'wb') as f:
        f.write(data)
    print(f"  Saved {out_path} ({len(data)//1024} KB)")
    return True

targets = [
    ("yeludeguang", ["耶律德光", "辽太宗"]),
    ("zhuyoujian",  ["崇祯帝", "朱由检"]),
]

assets_dir = "assets"
for eid, names in targets:
    out = os.path.join(assets_dir, f"{eid}.jpg")
    print(f"\n[{eid}]")
    for name in names:
        url = fetch_wiki_thumb(name, eid)
        if url:
            try:
                ok = download_img(url, out)
                if ok:
                    break
            except Exception as e:
                print(f"  Download failed: {e}")
        time.sleep(1)

print("\nDone!")
