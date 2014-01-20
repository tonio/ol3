goog.provide('ol.renderer.webgl.VectorLayer');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('goog.functions');
goog.require('ol.ViewHint');
goog.require('ol.extent');
goog.require('ol.feature');
goog.require('ol.layer.Vector');
goog.require('ol.render.webgl.ReplayGroup');
goog.require('ol.renderer.vector');
goog.require('ol.renderer.webgl.Layer');
goog.require('ol.renderer.webgl.vectorlayer.shader');
goog.require('ol.source.Vector');
goog.require('ol.vec.Mat4');



/**
 * @constructor
 * @extends {ol.renderer.webgl.Layer}
 * @param {ol.renderer.Map} mapRenderer Map renderer.
 * @param {ol.layer.Vector} vectorLayer Vector layer.
 */
ol.renderer.webgl.VectorLayer = function(mapRenderer, vectorLayer) {

  goog.base(this, mapRenderer, vectorLayer);

  /**
   * @private
   * @type {ol.webgl.shader.Fragment}
   */
  this.fragmentShader_ =
      ol.renderer.webgl.vectorlayer.shader.Fragment.getInstance();

  /**
   * @private
   * @type {ol.webgl.shader.Vertex}
   */
  this.vertexShader_ =
      ol.renderer.webgl.vectorlayer.shader.Vertex.getInstance();

  /**
   * @private
   * @type {ol.renderer.webgl.vectorlayer.shader.Locations}
   */
  this.locations_ = null;

  /**
   * @private
   * @type {boolean}
   */
  this.dirty_ = false;

  /**
   * @private
   * @type {number}
   */
  this.renderedRevision_ = -1;

  /**
   * @private
   * @type {ol.Extent}
   */
  this.renderedExtent_ = ol.extent.createEmpty();

  /**
   * @private
   * @type {ol.render.webgl.ReplayGroup}
   */
  this.replayGroup_ = null;

};
goog.inherits(ol.renderer.webgl.VectorLayer, ol.renderer.webgl.Layer);


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorLayer.prototype.composeFrame =
    function(frameState, layerState, context) {

  var gl = context.getGL();

  var program = context.getProgram(
      this.fragmentShader_, this.vertexShader_);
  context.useProgram(program);

  if (goog.isNull(this.locations_)) {
    this.locations_ =
        new ol.renderer.webgl.vectorlayer.shader.Locations(
            gl, program);
  }

  var view2DState = frameState.view2DState;
  ol.vec.Mat4.makeTransform2D(this.projectionMatrix,
      0.0, 0.0,
      2 / (view2DState.resolution * frameState.size[0]),
      2 / (view2DState.resolution * frameState.size[1]),
      -view2DState.rotation,
      -view2DState.center[0], -view2DState.center[1]);

  var replayGroup = this.replayGroup_;
  if (!goog.isNull(replayGroup) && !replayGroup.isEmpty()) {
    var renderGeometryFunction = this.getRenderGeometryFunction_();
    goog.asserts.assert(goog.isFunction(renderGeometryFunction));
    replayGroup.replay(context,
        this.locations_.a_position,
        this.locations_.u_projectionMatrix,
        frameState.extent, frameState.pixelRatio,
        this.projectionMatrix,
        renderGeometryFunction);
  }

};


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorLayer.prototype.forEachFeatureAtPixel =
    function(coordinate, frameState, callback, thisArg) {
};


/**
 * @private
 * @return {function(ol.geom.Geometry): boolean} Render geometry function.
 */
ol.renderer.webgl.VectorLayer.prototype.getRenderGeometryFunction_ =
    function() {
  var vectorLayer = this.getLayer();
  goog.asserts.assertInstanceof(vectorLayer, ol.layer.Vector);
  var renderGeometryFunctions = vectorLayer.getRenderGeometryFunctions();
  if (!goog.isDef(renderGeometryFunctions)) {
    return goog.functions.TRUE;
  }
  var renderGeometryFunctionsArray = renderGeometryFunctions.getArray();
  switch (renderGeometryFunctionsArray.length) {
    case 0:
      return goog.functions.TRUE;
    case 1:
      return renderGeometryFunctionsArray[0];
    default:
      return (
          /**
           * @param {ol.geom.Geometry} geometry Geometry.
           * @return {boolean} Render geometry.
           */
          function(geometry) {
            var i, ii;
            for (i = 0, ii = renderGeometryFunctionsArray.length; i < ii; ++i) {
              if (!renderGeometryFunctionsArray[i](geometry)) {
                return false;
              }
            }
            return true;
          });
  }
};


/**
 * Handle changes in image style state.
 * @param {goog.events.Event} event Image style change event.
 * @private
 */
ol.renderer.webgl.VectorLayer.prototype.handleImageChange_ =
    function(event) {
  this.renderIfReadyAndVisible();
};


/**
 * @inheritDoc
 */
ol.renderer.webgl.VectorLayer.prototype.prepareFrame =
    function(frameState, layerState, context) {

  var vectorLayer = this.getLayer();
  goog.asserts.assertInstanceof(vectorLayer, ol.layer.Vector);
  var vectorSource = vectorLayer.getSource();
  goog.asserts.assertInstanceof(vectorSource, ol.source.Vector);

  this.updateAttributions(
      frameState.attributions, vectorSource.getAttributions());
  this.updateLogos(frameState, vectorSource);

  if (!this.dirty_ && (frameState.viewHints[ol.ViewHint.ANIMATING] ||
      frameState.viewHints[ol.ViewHint.INTERACTING])) {
    return;
  }

  var frameStateExtent = frameState.extent;
  var frameStateResolution = frameState.view2DState.resolution;
  var pixelRatio = frameState.pixelRatio;
  var vectorLayerRevision = vectorLayer.getRevision();

  if (!this.dirty_ &&
      this.renderedRevision_ == vectorLayerRevision &&
      ol.extent.containsExtent(this.renderedExtent_, frameStateExtent)) {
    return;
  }

  var extent = this.renderedExtent_;
  var xBuffer = ol.extent.getWidth(frameStateExtent) / 4;
  var yBuffer = ol.extent.getHeight(frameStateExtent) / 4;
  extent[0] = frameStateExtent[0] - xBuffer;
  extent[1] = frameStateExtent[1] - yBuffer;
  extent[2] = frameStateExtent[2] + xBuffer;
  extent[3] = frameStateExtent[3] + yBuffer;

  // FIXME dispose of old replayGroup in post render
  goog.dispose(this.replayGroup_);
  this.replayGroup_ = null;

  this.dirty_ = false;

  var styleFunction = vectorLayer.getStyleFunction();
  if (!goog.isDef(styleFunction)) {
    styleFunction = ol.feature.defaultStyleFunction;
  }
  var tolerance = frameStateResolution / (2 * pixelRatio);
  var replayGroup = new ol.render.webgl.ReplayGroup(tolerance);
  vectorSource.forEachFeatureInExtent(extent,
      /**
       * @param {ol.Feature} feature Feature.
       */
      function(feature) {
        var dirty =
            this.renderFeature(feature, frameStateResolution, pixelRatio,
                styleFunction, replayGroup);
        this.dirty_ = this.dirty_ || dirty;
      }, this);
  replayGroup.finish(context);

  this.renderedRevision_ = vectorLayerRevision;
  this.replayGroup_ = replayGroup;

};


/**
 * @param {ol.Feature} feature Feature.
 * @param {number} resolution Resolution.
 * @param {number} pixelRatio Pixel ratio.
 * @param {ol.feature.StyleFunction} styleFunction Style function.
 * @param {ol.render.webgl.ReplayGroup} replayGroup Replay group.
 * @return {boolean} `true` if an image is loading.
 */
ol.renderer.webgl.VectorLayer.prototype.renderFeature =
    function(feature, resolution, pixelRatio, styleFunction, replayGroup) {
  var styles = styleFunction(feature, resolution);
  if (!goog.isDefAndNotNull(styles)) {
    return false;
  }
  // simplify to a tolerance of half a device pixel
  var squaredTolerance =
      resolution * resolution / (4 * pixelRatio * pixelRatio);
  var i, ii, loading = false;
  for (i = 0, ii = styles.length; i < ii; ++i) {
    loading = ol.renderer.vector.renderFeature(
        replayGroup, feature, styles[i], squaredTolerance, feature,
        this.handleImageChange_, this) || loading;
  }
  return loading;
};
