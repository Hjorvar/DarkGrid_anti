import os
import sys
import json
from PIL import Image

def process_image(src_path, slug):
    if not os.path.exists(src_path):
        print(f"Error: source path does not exist: {src_path}")
        return False
    
    dest1 = os.path.join("images", "monsters", f"{slug}_defeated.png")
    dest2 = os.path.join("public", "images", "monsters", f"{slug}_defeated.png")
    
    os.makedirs(os.path.dirname(dest1), exist_ok=True)
    os.makedirs(os.path.dirname(dest2), exist_ok=True)
    
    im = Image.open(src_path)
    # Ensure RGB mode (strip alpha if necessary or keep PNG)
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert('RGBA')
    else:
        im = im.convert('RGB')
    
    im.save(dest1, "PNG", optimize=True)
    im.save(dest2, "PNG", optimize=True)
    print(f"[OK] Saved {slug}_defeated.png ({im.size[0]}x{im.size[1]}) to images/ and public/images/")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python process_image.py <source_path> <slug>")
        sys.exit(1)
    src = sys.argv[1]
    slug = sys.argv[2]
    success = process_image(src, slug)
    sys.exit(0 if success else 1)
