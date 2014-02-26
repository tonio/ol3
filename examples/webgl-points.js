goog.require('ol.BrowserFeature');
goog.require('ol.Map');
goog.require('ol.View2D');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.OSM');
goog.require('ol.source.GeoJSON');
goog.require('ol.style.Circle');
goog.require('ol.style.Fill');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');


var style = new ol.style.Style({
  image: new ol.style.Circle({
    radius: 2,
    fill: new ol.style.Fill({color: 'red'}),
    stroke: new ol.style.Stroke({color: 'white', width: 1})
  })
});

var vectorLayer = new ol.layer.Vector({
  style: style,
  source: new ol.source.GeoJSON({
      object: {
        'type': 'FeatureCollection',
        'crs': {
          'type': 'name',
          'properties': {
            'name': 'EPSG:3857'
          }
        },
        'features': [
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [0, 0]
            }
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [1e6, 0]
            }
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'MultiPoint',
              'coordinates': [ [-2e6, -2e6], [0, -2e6], [2e6, -2e6]]
            }
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [-1e6, 0]
            }
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [0, -1e6]
            }
          },
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': [0, 1e6]
            }
          }
          ]}})
});

if (ol.BrowserFeature.HAS_WEBGL) {
  var map = new ol.Map({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM()
      }),
      vectorLayer
    ],
    renderer: 'webgl',
    target: 'map',
    view: new ol.View2D({
      center: [0, 0],
      zoom: 1
    })
  });
} else {
  var info = document.getElementById('no-webgl');
  /**
   * display error message
   */
  info.style.display = '';
}
