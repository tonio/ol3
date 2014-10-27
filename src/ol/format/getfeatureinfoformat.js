goog.provide('ol.format.GetFeatureInfo');

goog.require('goog.asserts');
goog.require('goog.dom');
goog.require('goog.dom.NodeType');
goog.require('goog.object');
goog.require('goog.string');
goog.require('ol.format.GML');
goog.require('ol.format.GML2');
goog.require('ol.format.GMLBase');
goog.require('ol.format.XMLFeature');
goog.require('ol.xml');



/**
 * @classdesc
 * Format for reading MapServer GetFeatureInfo format.It uses
 * ol.format.GML2 to read features.
 *
 * @constructor
 * @param {olx.format.GMLOptions=} opt_options
 *     Optional configuration object.
 * @extends {ol.format.XMLFeature}
 * @api
 */
ol.format.GetFeatureInfo = function(opt_options) {

  /**
   * @private
   * @type {string}
   */
  this.featureNS_ = 'http://mapserver.gis.umn.edu/mapserver';


  /**
   * @private
   * @type {string}
   */
  this.featureIdentifier_ = '_feature';


  /**
   * @private
   * @type {string}
   */
  this.layerIdentifier_ = '_layer';


  /**
   * @private
   * @type {ol.format.GMLBase}
   */
  this.gmlFormat_ = new ol.format.GML2();

  goog.base(this);
};
goog.inherits(ol.format.GetFeatureInfo, ol.format.XMLFeature);


/**
 * @const
 * @type {string}
 * @private
 */
ol.format.GetFeatureInfo.schemaLocation_ = '';


/**
 * @param {Node} node Node.
 * @param {Array.<*>} objectStack Object stack.
 * @return {Array.<ol.Feature>} Features.
 * @private
 */
ol.format.GetFeatureInfo.prototype.readFeatures_ = function(node, objectStack) {

  node.namespaceURI = this.featureNS_;
  goog.asserts.assert(node.nodeType == goog.dom.NodeType.ELEMENT);
  var localName = ol.xml.getLocalName(node);
  var features;
  if (localName == 'msGMLOutput') {
    var context = objectStack[0];
    goog.asserts.assert(goog.isObject(context));

    var layer = node.firstElementChild;
    goog.asserts.assert(layer.localName.indexOf(this.layerIdentifier_) >= 0);

    var featureType = goog.string.remove(layer.localName,
        this.layerIdentifier_) + this.featureIdentifier_;

    goog.object.set(context, 'featureType', featureType);
    goog.object.set(context, 'featureNS', this.featureNS_);

    var parsers = {};
    var parsersNS = {};
    parsers[featureType] = ol.xml.makeArrayPusher(
        this.gmlFormat_.readFeatureElement, this.gmlFormat_);
    parsersNS[goog.object.get(context, 'featureNS')] = parsers;
    features = ol.xml.pushParseAndPop([], parsersNS, layer, objectStack,
        this.gmlFormat_);
  }
  if (!goog.isDef(features)) {
    features = [];
  }
  return features;
};


/**
 * @inheritDoc
 */
ol.format.GetFeatureInfo.prototype.readFeaturesFromNode =
    function(node, opt_options) {
  var options = {
    'featureType': this.featureType,
    'featureNS': this.featureNS
  };
  if (goog.isDef(opt_options)) {
    goog.object.extend(options, this.getReadOptions(node, opt_options));
  }
  return this.readFeatures_(node, [options]);
};
