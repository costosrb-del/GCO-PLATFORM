
import urllib.request
import json

def download_data():
    url = "https://gist.githubusercontent.com/john-guerra/43c7656821069d00dcbc/raw/colombia.geo.json"
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))

def project(lon, lat):
    # Longitude: -82 to -66
    # Latitude: -4.5 to 13.5
    # We want to fill a 600x800 area.
    lon_min, lon_max = -80, -66
    lat_min, lat_max = -4.5, 13.5
    
    width = 600
    height = 800
    
    x = (lon - lon_min) / (lon_max - lon_min) * width
    y = (lat_max - lat) / (lat_max - lat_min) * height
    return round(x, 2), round(y, 2)

def convert_to_svg_path(geometry):
    if geometry['type'] == 'Polygon':
        polygons = [geometry['coordinates']]
    elif geometry['type'] == 'MultiPolygon':
        polygons = geometry['coordinates']
    else:
        return ""

    paths = []
    for poly in polygons:
        for ring in poly:
            if not ring: continue
            path_segments = []
            for i, pt in enumerate(ring):
                x, y = project(pt[0], pt[1])
                if i == 0:
                    path_segments.append(f"M{x},{y}")
                else:
                    path_segments.append(f"L{x},{y}")
            path_segments.append("Z")
            paths.append(" ".join(path_segments))
    
    return " ".join(paths)

def main():
    try:
        data = download_data()
    except Exception as e:
        print(f"Error: {e}")
        return

    svg_data = []
    for feature in data['features']:
        props = feature.get('properties', {})
        # Updated mapping based on inspection
        name = props.get('NOMBRE_DPT', 'DESCONOCIDO').upper()
        dept_id = props.get('DPTO', '00')
        
        path = convert_to_svg_path(feature['geometry'])
        svg_data.append({
            "id": dept_id,
            "name": name,
            "path": path
        })

    with open('colombia_svg_data.json', 'w', encoding='utf-8') as f:
        json.dump(svg_data, f, indent=4)
    print("Saved to colombia_svg_data.json")

if __name__ == "__main__":
    main()
