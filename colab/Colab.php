from google.colab import drive
import os
import glob
import json
import torch
import numpy as np
import cv2
import csv
import matplotlib.pyplot as plt
import shutil
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
from scipy.signal import find_peaks
from pillow_heif import register_heif_opener
register_heif_opener()

# --- 1. GOOGLE DRIVE EINBINDEN ---
drive.mount('/content/drive')

input_ordner = "/content/drive/MyDrive/PanoramaProjekt/panorama_upload"
processed_ordner = "/content/drive/MyDrive/PanoramaProjekt/panorama_upload_processed"
export_ordner = "/content/drive/MyDrive/PanoramaProjekt/panorama_daten"

os.makedirs(input_ordner, exist_ok=True)
os.makedirs(processed_ordner, exist_ok=True)
os.makedirs(export_ordner, exist_ok=True)

# --- EXIF & GPS EXTRAKTION (HEIC & JPEG kompatibel) ---
def umrechnen_in_dezimal(gps_coords, referenz):
    try:
        grad = float(gps_coords[0][0]) / float(gps_coords[0][1]) if isinstance(gps_coords[0], (list, tuple)) else float(gps_coords[0])
        minuten = float(gps_coords[1][0]) / float(gps_coords[1][1]) if isinstance(gps_coords[1], (list, tuple)) else float(gps_coords[1])
        sekunden = float(gps_coords[2][0]) / float(gps_coords[2][1]) if isinstance(gps_coords[2], (list, tuple)) else float(gps_coords[2])
    except Exception:
        grad, minuten, sekunden = map(float, gps_coords)
        
    dezimal = grad + minuten/60 + sekunden/3600
    if str(referenz).upper() in ['S', 'W']:
        dezimal *= -1
    return round(dezimal, 5)

def extrahiere_foto_daten(bildpfad):
    daten = {'datum': '', 'kamera': '', 'autor': '', 'koordinaten': ''}
    try:
        img = Image.open(bildpfad)
        exif = img.getexif()
        if not exif: 
            return daten
            
        exif_dict = {TAGS.get(k, k): v for k, v in exif.items()}
        
        # Datum im Haupt-EXIF oder im Exif-Sub-IFD suchen
        datum = exif_dict.get('DateTimeOriginal', exif_dict.get('DateTime', ''))
        if not datum and hasattr(exif, "get_ifd"):
            try:
                sub_exif = exif.get_ifd(0x8769)
                sub_dict = {TAGS.get(k, k): v for k, v in sub_exif.items()}
                datum = sub_dict.get('DateTimeOriginal', sub_dict.get('DateTime', ''))
            except Exception:
                pass
        daten['datum'] = str(datum).strip()
        
        kamera_make = str(exif_dict.get('Make', '')).strip()
        kamera_model = str(exif_dict.get('Model', '')).strip()
        daten['kamera'] = f"{kamera_make} {kamera_model}".strip()
        daten['autor'] = str(exif_dict.get('Artist', exif_dict.get('Copyright', ''))).strip()
        
        # GPS-Daten auslesen (entweder direkt oder via GPSInfo-Sub-IFD 0x8825)
        gps_raw = exif_dict.get('GPSInfo')
        if not gps_raw and hasattr(exif, "get_ifd"):
            try:
                gps_raw = exif.get_ifd(0x8825)
            except Exception:
                pass
                
        if gps_raw:
            gps_info = {GPSTAGS.get(t, t): gps_raw[t] for t in gps_raw}
            if 'GPSLatitude' in gps_info and 'GPSLongitude' in gps_info:
                lat = umrechnen_in_dezimal(gps_info['GPSLatitude'], gps_info.get('GPSLatitudeRef', 'N'))
                lon = umrechnen_in_dezimal(gps_info['GPSLongitude'], gps_info.get('GPSLongitudeRef', 'E'))
                daten['koordinaten'] = f"{lat}, {lon}"
    except Exception as e:
        print(f"Hinweis: Konnte EXIF für {os.path.basename(bildpfad)} nicht vollständig lesen: {e}")
        
    return daten

# --- 2. KONFIGURATION LADEN ---
try:
    with open("/content/config.json", "r") as f:
        config = json.load(f)
except:
    config = {
        "abstand_prozent": 5.0,
        "anzahl_peaks": 5,
        "anzahl_taeler": 3,
        "abspiel_art": "links_nach_rechts"
    }

# --- 3. BILD-VERARBEITUNG ---
# Neu:
such_muster = ["*.jpg", "*.JPG", "*.jpeg", "*.JPEG", "*.heic", "*.HEIC", "*.png", "*.PNG"]
bild_dateien = []
for muster in such_muster:
    bild_dateien.extend(glob.glob(os.path.join(input_ordner, muster)))

# Doppelte Einträge entfernen und versteckte Dateien ausschließen
bild_dateien = list(set([f for f in bild_dateien if not os.path.basename(f).startswith('.')]))
#bild_dateien = [f for f in glob.glob(os.path.join(input_ordner, "*.*")) if not os.path.basename(f).startswith('.')]
csv_daten = []
csv_header = ["id", "titel", "datum", "kamera", "autor", "position", "bildUrl", "arrayUrl", "peaks", "valleys"]

if bild_dateien:
    print(f"{len(bild_dateien)} Bilder in '{input_ordner}' gefunden. Lade KI...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_name = "nvidia/segformer-b0-finetuned-ade-512-512"
    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForSemanticSegmentation.from_pretrained(model_name).to(device)

    for image_path in bild_dateien:
        base_name = os.path.splitext(os.path.basename(image_path))[0]
        print(f"\nVerarbeite: {base_name}...")

        try:
            metadaten = extrahiere_foto_daten(image_path)

            image = Image.open(image_path).convert("RGB")
            orig_w, orig_h = image.size

            # RAM-Schutz: Auf max. 2500px Breite skalieren
            max_breite = 2500
            if orig_w > max_breite:
                faktor = max_breite / orig_w
                orig_w, orig_h = max_breite, int(orig_h * faktor)
                image = image.resize((orig_w, orig_h), Image.Resampling.LANCZOS)

            inputs = processor(images=image, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.no_grad():
                outputs = model(**inputs)

            pred_mask = torch.nn.functional.interpolate(outputs.logits, size=(orig_h, orig_w), mode="bilinear", align_corners=False).argmax(dim=1)[0].cpu().numpy()
            sky_mask = (pred_mask == 2).astype(np.uint8)

            skyline_y = np.array([np.where(sky_mask[:, x] == 0)[0][0] if len(np.where(sky_mask[:, x] == 0)[0]) > 0 else orig_h - 1 for x in range(orig_w)])
            norm_y = (((orig_h - skyline_y) - (orig_h - skyline_y).min()) / ((orig_h - skyline_y).max() - (orig_h - skyline_y).min() + 1e-5)) * 100

            # JSON für Web speichern
            json_daten = {"bild_breite": orig_w, "bild_hoehe": orig_h, "kurve_y": skyline_y.tolist()}
            with open(os.path.join(export_ordner, f"{base_name}.json"), "w") as jf:
                json.dump(json_daten, jf)

            # Peaks & Valleys
            abstand_pixel = int(orig_w * (config.get("abstand_prozent", 5.0) / 100.0))
            peaks, _ = find_peaks(norm_y, distance=abstand_pixel)
            top_peaks_idx = peaks[np.argsort(norm_y[peaks])][-config.get("anzahl_peaks", 5):] if config.get("anzahl_peaks", 5) > 0 else []
            valleys, _ = find_peaks(-norm_y, distance=abstand_pixel)
            bottom_valleys_idx = valleys[np.argsort(norm_y[valleys])][:config.get("anzahl_taeler", 3)] if config.get("anzahl_taeler", 3) > 0 else []

            csv_daten.append([
                base_name, base_name.replace("_", " ").title(), metadaten['datum'], 
                metadaten['kamera'], metadaten['autor'], metadaten['koordinaten'], 
                f"URL/{base_name}.jpg", f"URL/{base_name}.json",
                len(top_peaks_idx), len(bottom_valleys_idx)
            ])

            # Visualisiertes Bild speichern
            fig, ax = plt.subplots(figsize=(10, 4))
            img_with_line = np.array(image).copy()
            for x in range(orig_w): cv2.circle(img_with_line, (x, int(skyline_y[x])), radius=1, color=(255, 0, 0), thickness=-1)
            
            alle_punkte = [(x, norm_y[x], "peak") for x in top_peaks_idx] + [(x, norm_y[x], "valley") for x in bottom_valleys_idx]
            for x, y_val, typ in alle_punkte:
                cv2.circle(img_with_line, (x, int(skyline_y[x])), radius=12, color=(0, 255, 0) if typ == "peak" else (0, 100, 255), thickness=4)
            
            ax.imshow(image); ax.axis("off"); plt.show()

            cv2.imwrite(os.path.join(export_ordner, f"{base_name}.jpg"), cv2.cvtColor(img_with_line, cv2.COLOR_RGB2BGR))

            # RAM bereinigen
            del inputs, outputs, pred_mask, sky_mask
            torch.cuda.empty_cache()

            # Originalbild verschieben
            shutil.move(image_path, os.path.join(processed_ordner, os.path.basename(image_path)))
            print(f"Erfolgreich verarbeitet & verschoben: {base_name}")

        except Exception as e:
            print(f"⚠️ Überspringe Datei '{image_path}' wegen Fehler: {e}")
            continue

    # CSV schreiben
    if csv_daten:
        with open(os.path.join(export_ordner, "_panoramen_daten.csv"), "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(csv_header)
            writer.writerows(csv_daten)

    shutil.make_archive("/content/landschafts_synth", 'zip', export_ordner)
    print("\n✅ Durchlauf beendet! Keine WAV-Dateien erzeugt. Export-Ordner aktualisiert.")
else:
    print(f"Keine gültigen Bilder in '{input_ordner}' gefunden.")