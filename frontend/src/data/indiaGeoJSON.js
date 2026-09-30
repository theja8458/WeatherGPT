// Simplified GeoJSON FeatureCollection of Indian States & Meteorological Subdivisions
// Designed for fast rendering in Leaflet without heavy polygon overhead

export const indiaGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Andhra Pradesh", subdivision: "Coastal Andhra & Rayalaseema", code: "AP" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.8, 12.8], [78.2, 12.8], [80.2, 13.5], [80.6, 15.5], [82.3, 16.9],
          [83.4, 17.8], [84.5, 19.1], [83.5, 18.8], [82.5, 18.2], [81.3, 17.8],
          [80.0, 16.2], [79.2, 15.8], [78.5, 16.2], [77.5, 15.8], [77.0, 15.0],
          [76.8, 14.0], [76.8, 12.8]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Telangana", subdivision: "Telangana", code: "TG" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.3, 15.9], [78.5, 16.2], [79.2, 15.8], [80.3, 16.5], [80.8, 17.5],
          [80.5, 18.8], [79.8, 19.8], [78.6, 19.8], [77.8, 19.3], [77.3, 18.2],
          [77.2, 17.0], [77.3, 15.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Tamil Nadu", subdivision: "Tamil Nadu & Puducherry", code: "TN" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.8, 12.8], [80.2, 13.5], [79.8, 11.0], [79.8, 10.3], [79.0, 9.2],
          [77.5, 8.1], [77.2, 8.5], [76.5, 10.2], [76.8, 11.8], [76.8, 12.8]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Karnataka", subdivision: "South & North Interior Karnataka", code: "KA" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.1, 14.8], [75.0, 15.8], [75.5, 17.5], [77.2, 17.8], [77.3, 15.9],
          [76.8, 14.0], [76.8, 12.8], [76.8, 11.8], [75.2, 12.5], [74.8, 13.5],
          [74.1, 14.8]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kerala", subdivision: "Kerala & Mahe", code: "KL" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.8, 12.5], [75.8, 12.0], [76.5, 10.2], [77.2, 8.5], [77.5, 8.1],
          [76.9, 8.5], [76.2, 9.8], [75.5, 11.2], [74.8, 12.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Maharashtra", subdivision: "Konkan, Madhya Maharashtra, Vidarbha", code: "MH" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [72.8, 18.9], [73.5, 20.0], [74.5, 21.5], [76.8, 21.5], [79.0, 21.7],
          [80.8, 21.2], [80.3, 19.5], [78.6, 19.8], [77.2, 17.8], [75.5, 17.5],
          [73.8, 15.8], [73.2, 16.5], [72.8, 18.9]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Gujarat", subdivision: "Gujarat Region, Saurashtra & Kutch", code: "GJ" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [68.5, 23.5], [70.5, 24.5], [72.5, 24.5], [73.5, 24.0], [74.0, 22.5],
          [73.5, 20.5], [72.8, 20.8], [72.0, 21.8], [70.5, 20.8], [69.0, 22.2],
          [68.5, 23.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Rajasthan", subdivision: "East & West Rajasthan", code: "RJ" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [70.0, 26.5], [70.5, 28.0], [73.5, 30.0], [75.5, 29.5], [77.2, 28.2],
          [77.8, 27.2], [76.8, 25.0], [74.0, 24.0], [72.5, 24.5], [71.0, 25.0],
          [70.0, 26.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Madhya Pradesh", subdivision: "West & East Madhya Pradesh", code: "MP" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.5, 22.0], [75.5, 24.5], [77.5, 26.5], [79.5, 25.5], [82.5, 24.5],
          [82.0, 22.5], [80.5, 21.5], [77.5, 21.5], [74.5, 22.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Uttar Pradesh", subdivision: "West & East Uttar Pradesh", code: "UP" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [77.2, 28.2], [77.5, 30.0], [79.8, 29.0], [81.5, 28.0], [84.0, 27.5],
          [84.5, 25.5], [83.0, 24.0], [80.5, 25.0], [78.5, 26.5], [77.2, 28.2]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bihar", subdivision: "Bihar", code: "BR" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [84.0, 27.5], [86.5, 27.2], [88.0, 26.5], [87.5, 24.5], [84.5, 24.5],
          [84.0, 27.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "West Bengal", subdivision: "Gangetic West Bengal & Sub-Himalayan", code: "WB" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [87.5, 24.5], [88.0, 26.5], [89.0, 27.2], [89.5, 26.2], [88.8, 24.5],
          [88.8, 22.0], [87.5, 21.5], [86.8, 22.5], [87.5, 24.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Odisha", subdivision: "Odisha", code: "OD" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [83.5, 18.8], [84.5, 19.1], [86.5, 20.2], [87.2, 21.5], [86.0, 22.5],
          [84.0, 22.0], [82.5, 20.5], [82.5, 18.5], [83.5, 18.8]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Delhi NCR", subdivision: "Delhi", code: "DL" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [76.8, 28.4], [77.4, 28.8], [77.5, 28.4], [77.1, 28.3], [76.8, 28.4]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Punjab & Haryana", subdivision: "Punjab & Haryana", code: "PB_HR" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.0, 30.5], [75.5, 32.2], [77.0, 31.0], [77.5, 30.0], [77.2, 28.2],
          [75.5, 29.5], [74.0, 30.5]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Jammu & Kashmir & Ladakh", subdivision: "J&K and Ladakh", code: "JK" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [74.0, 33.0], [75.0, 35.5], [78.5, 35.5], [79.5, 33.5], [77.0, 32.5],
          [75.0, 32.5], [74.0, 33.0]
        ]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Assam & Northeast", subdivision: "Northeastern States", code: "NE" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [89.5, 26.2], [92.0, 27.5], [95.5, 28.0], [96.5, 26.5], [93.5, 24.5],
          [91.5, 24.8], [89.5, 26.2]
        ]]
      }
    }
  ]
};

export default indiaGeoJSON;
