goog.require('ol.BrowserFeature');
goog.require('ol.Map');
goog.require('ol.View2D');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.BingMaps');
goog.require('ol.source.TWKB');
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

var vectorSource = new ol.source.TWKB({
  url: 'data/cell-towers-multipoint-100K.twkb'
});

var vectorLayer = new ol.layer.Vector({
  source: vectorSource,
  style: style
});

if (ol.BrowserFeature.HAS_WEBGL) {
  var key =
      'Ak-dzM4wZjSqTlzveKz5u0d4IQ4bRzVI309GxmkgSVr1ewS6iPSrOvOKhA-CJlm3';
  var map = new ol.Map({
    layers: [
      new ol.layer.Tile({
        source: new ol.source.BingMaps({
          key: key,
          imagerySet: 'Aerial'
        })
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
