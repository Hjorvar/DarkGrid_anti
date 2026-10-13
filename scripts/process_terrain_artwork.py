import os
import hashlib
from PIL import Image, ImageDraw, ImageFont

SRC_DIR = r"C:\Users\hih\.gemini\antigravity\brain\7c56d692-3403-4e85-891f-e9b740ff5202"
DEST_DIR = os.path.abspath("public/images/terrain")
os.makedirs(DEST_DIR, exist_ok=True)

# Master list of all terrain artwork assets
ASSETS = [
    {
        "id": "ART-01",
        "name": "Oakhaven City",
        "theme": "Sanctuary in a dangerous world",
        "terrain": "CITY",
        "status": "APPROVED",
        "src_file": "oakhaven_city_concept_art_1791895867531.jpg",
        "dest_file": "terrain_city_oakhaven.webp"
    },
    {
        "id": "ART-02",
        "name": "Oakhaven Town Gates",
        "theme": "The last threshold of safety",
        "terrain": "TOWN_GATES (Override)",
        "status": "APPROVED",
        "src_file": "art_02_oakhaven_town_gates_1791895894463.jpg",
        "dest_file": "terrain_town_gates.webp"
    },
    {
        "id": "ART-03",
        "name": "Ancient Forest",
        "theme": "Ancient woodland watching silently",
        "terrain": "FOREST",
        "status": "APPROVED",
        "src_file": "art_03_forest_1791895931988.jpg",
        "dest_file": "terrain_forest.webp"
    },
    {
        "id": "ART-04",
        "name": "Windswept Plains",
        "theme": "Exposed beneath an enormous sky",
        "terrain": "PLAINS",
        "status": "APPROVED",
        "src_file": "art_04_plains_1791895890589.jpg",
        "dest_file": "terrain_plains.webp"
    },
    {
        "id": "ART-05",
        "name": "Drowned Swamp",
        "theme": "A drowned and forgotten wilderness",
        "terrain": "SWAMP",
        "status": "APPROVED",
        "src_file": "art_05_swamp_1791895970514.jpg",
        "dest_file": "terrain_swamp.webp"
    },
    {
        "id": "ART-06B",
        "name": "Rolling Hills (Remake)",
        "theme": "Rolling heath & moorland beneath cold skies",
        "terrain": "HILLS",
        "status": "APPROVED",
        "src_file": "art_06b_hills_remake_1791897229835.jpg",
        "dest_file": "terrain_hills.webp"
    },
    {
        "id": "ART-06A",
        "name": "Craggy Mountains (Repurposed)",
        "theme": "Towering jagged peaks and crags",
        "terrain": "MOUNTAINS",
        "status": "APPROVED",
        "src_file": "art_06_hills_1791895891064.jpg",
        "dest_file": "terrain_mountains.webp"
    },
    {
        "id": "ART-07",
        "name": "Primeval Jungle",
        "theme": "Ancient wilderness swallowing the light",
        "terrain": "JUNGLE",
        "status": "APPROVED",
        "src_file": "art_07_jungle_1791895890171.jpg",
        "dest_file": "terrain_jungle.webp"
    },
    {
        "id": "ART-08",
        "name": "The Old Stone Bridge",
        "theme": "Ancient stone crossing over dark water",
        "terrain": "BRIDGE",
        "status": "APPROVED",
        "src_file": "art_08_old_stone_bridge_1791897284587.jpg",
        "dest_file": "terrain_bridge.webp"
    },
    {
        "id": "ART-09",
        "name": "Underground Ruins",
        "theme": "Vast subterranean halls and crypts",
        "terrain": "UNDERGROUND_RUINS",
        "status": "APPROVED",
        "src_file": "art_09_underground_ruins_1791897285112.jpg",
        "dest_file": "terrain_underground_ruins.webp"
    },
    {
        "id": "ART-10",
        "name": "Storm-Swept Coast",
        "theme": "Craggy cliffs meeting black surging waters",
        "terrain": "COAST",
        "status": "APPROVED",
        "src_file": "art_10_coast_rocky_storm_swept_coastline_1791897322684.jpg",
        "dest_file": "terrain_coast.webp"
    },
    {
        "id": "ART-11",
        "name": "Arid Desert Barrens",
        "theme": "Baking cracked earth and ancient monoliths",
        "terrain": "DESERT",
        "status": "APPROVED",
        "src_file": "art_11_desert_arid_wastes_1791897322202.jpg",
        "dest_file": "terrain_desert.webp"
    },
    {
        "id": "FALLBACK-V2",
        "name": "Misty Realm (Remake)",
        "theme": "Atmospheric mist-shrouded dark wilderness",
        "terrain": "FALLBACK (Neutral)",
        "status": "APPROVED",
        "src_file": "fallback_neutral_dark_fantasy_1791897229632.jpg",
        "dest_file": "terrain_fallback.webp"
    },
    {
        "id": "ARCHIVED-V1",
        "name": "Scorched Barrens (V1)",
        "theme": "Archived previous fallback asset",
        "terrain": "ARCHIVED",
        "status": "ARCHIVED",
        "src_file": "fallback_neutral_wilderness_1791895998359.jpg",
        "dest_file": "terrain_fallback_v1_scorched.webp"
    }
]

def find_file(prefix_or_exact):
    exact = os.path.join(SRC_DIR, prefix_or_exact)
    if os.path.exists(exact):
        return exact
    for f in os.listdir(SRC_DIR):
        if prefix_or_exact.lower() in f.lower():
            return os.path.join(SRC_DIR, f)
    raise FileNotFoundError(f"Could not find source image matching: {prefix_or_exact}")

def main():
    print("Processing Darkgrid Master Terrain Concept Artwork...")
    results = []
    processed_images = []

    target_w, target_h = 1536, 864  # 16:9 cinematic resolution

    for asset in ASSETS:
        src_path = find_file(asset["src_file"])
        dest_path = os.path.join(DEST_DIR, asset["dest_file"])
        print(f"Loading [{asset['id']}] {asset['name']} ({asset['status']})...")

        with Image.open(src_path) as img:
            img = img.convert("RGB")
            orig_w, orig_h = img.size

            # Center-crop to 16:9 if needed, then Lanczos resize
            target_aspect = target_w / target_h
            orig_aspect = orig_w / orig_h

            if abs(orig_aspect - target_aspect) > 0.01:
                if orig_aspect > target_aspect:
                    new_w = int(orig_h * target_aspect)
                    offset = (orig_w - new_w) // 2
                    img = img.crop((offset, 0, offset + new_w, orig_h))
                else:
                    new_h = int(orig_w / target_aspect)
                    offset = (orig_h - new_h) // 2
                    img = img.crop((0, offset, orig_w, offset + new_h))

            final_img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            final_img.save(dest_path, "WEBP", quality=90, method=6)
            processed_images.append((asset, final_img.copy()))

        file_size = os.path.getsize(dest_path)
        hasher = hashlib.sha256()
        with open(dest_path, "rb") as f:
            hasher.update(f.read())
        sha256 = hasher.hexdigest()

        results.append({
            "id": asset["id"],
            "name": asset["name"],
            "terrain": asset["terrain"],
            "status": asset["status"],
            "filename": asset["dest_file"],
            "size_bytes": file_size,
            "sha256": sha256
        })
        print(f"  -> Saved {asset['dest_file']} ({file_size / 1024:.1f} KB, SHA-256: {sha256[:12]}...)")

    # Generate master contact sheet (4 columns x 4 rows for 14 images)
    cols = 4
    rows = (len(processed_images) + cols - 1) // cols
    thumb_w, thumb_h = 360, 202
    pad = 18
    header_h = 75
    cell_h = thumb_h + 52
    sheet_w = cols * thumb_w + (cols + 1) * pad
    sheet_h = header_h + rows * cell_h + pad

    sheet = Image.new("RGB", (sheet_w, sheet_h), color=(14, 16, 20))
    draw = ImageDraw.Draw(sheet)

    # Header bar
    draw.rectangle([(0, 0), (sheet_w, header_h)], fill=(10, 11, 14))
    draw.line([(0, header_h), (sheet_w, header_h)], fill=(60, 50, 30), width=1)
    draw.text((pad, 14), "DARKGRID — OFFICIALLY APPROVED TERRAIN ARTWORK", fill=(212, 175, 55))
    draw.text((pad, 42), "All 13 Active Environments Approved & Integrated | Pathfinder 1e & Darkgrid Map", fill=(170, 170, 170))

    for idx, (asset, img) in enumerate(processed_images):
        col = idx % cols
        row = idx // cols

        x = pad + col * (thumb_w + pad)
        y = header_h + pad + row * cell_h

        thumb = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x, y))

        # Status border color
        if asset["status"] == "APPROVED":
            border_color = (60, 140, 70)  # Green
            status_text = "APPROVED"
            status_fill = (120, 220, 130)
        elif "PENDING" in asset["status"]:
            border_color = (212, 175, 55)  # Gold
            status_text = "PENDING APPROVAL"
            status_fill = (240, 200, 80)
        else:
            border_color = (90, 90, 100)  # Gray
            status_text = "ARCHIVED (V1)"
            status_fill = (140, 140, 150)

        draw.rectangle([(x - 1, y - 1), (x + thumb_w, y + thumb_h)], outline=border_color, width=2)

        # Labels
        label_y = y + thumb_h + 6
        draw.text((x, label_y), f"[{asset['id']}] {asset['name']}", fill=(240, 235, 220))
        draw.text((x, label_y + 18), f"{asset['dest_file']} • {asset['terrain']}", fill=(150, 155, 165))
        draw.text((x, label_y + 32), f"[{status_text}]", fill=status_fill)

    contact_path = os.path.join(DEST_DIR, "master_terrain_contact_sheet.png")
    sheet.save(contact_path, "PNG")
    print(f"\nMaster contact sheet saved to: {contact_path}")

    # Copy contact sheet to artifacts directory
    artifact_contact = os.path.join(SRC_DIR, "master_terrain_contact_sheet.png")
    sheet.save(artifact_contact, "PNG")
    print(f"Artifact contact sheet saved to: {artifact_contact}")

    # Print summary table
    print("\n--- MASTER TERRAIN ARTWORK ASSET MANIFEST ---")
    print(f"{'Asset ID':<12} {'Name':<28} {'Status':<25} {'Filename':<30} {'Size (KB)':<10} {'SHA-256'}")
    print("-" * 125)
    for r in results:
        print(f"{r['id']:<12} {r['name']:<28} {r['status']:<25} {r['filename']:<30} {r['size_bytes']/1024:<10.1f} {r['sha256']}")

if __name__ == "__main__":
    main()
