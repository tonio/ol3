goog.provide('ol.Transaction');

goog.require('goog.events');
goog.require('goog.object');
goog.require('ol.Feature');
goog.require('ol.ObjectEventType');
goog.require('ol.geom.Geometry');
goog.require('ol.source.VectorEventType');



/**
 * Keeps track of pending feature edits.
 * @constructor
 */
ol.Transaction = function() {

  /**
   * Lookup for newly created features.
   * @type {Object.<string, ol.Feature>}
   * @private
   */
  this.inserts_ = {};

  /**
   * Lookup for modified features.
   * @type {Object.<string, ol.Feature>}
   * @private
   */
  this.updates_ = {};

  /**
   * Lookup for originals of modified features.
   * @type {Object.<string, ol.Feature>}
   * @private
   */
  this.originals_ = {};

  /**
   * Lookup for deleted features.
   * @type {Object.<string, ol.Feature>}
   * @private
   */
  this.deletes_ = {};

  /**
   * The vector source associated with this transaction.
   * @type {ol.source.Vector}
   * @private
   */
  this.source_ = null;

  /**
   * Flag to indicate that a rollback is underway.
   * @type {boolean}
   * @private
   */
  this.rollingBack_ = false;

};


/**
 * Clear information about the added, changed, and removed features.
 */
ol.Transaction.prototype.reset = function() {
  this.inserts_ = {};
  this.originals = {};
  this.updates_ = {};
  this.deletes_ = {};
};


/**
 * Revert all changes tracked by this transaction.
 */
ol.Transaction.prototype.rollback = function() {
  var source = this.source_,
      id, feature, features;

  if (goog.isNull(source)) {
    return;
  }

  // unload all inserted features
  source.unloadFeatures(goog.object.getValues(this.inserts_));

  // temporarily ignore featurechange events
  this.rollingBack_ = true;

  // reset all modified features
  for (id in this.updates_) {
    this.restoreOriginal_(this.updates_[id]);
  }

  // reload all deleted features
  features = [];
  for (id in this.deletes_) {
    feature = this.deletes_[id];
    this.restoreOriginal_(this.updates_[id]);
    features.push(feature);
    source.loadFeatures(features);
  }

  this.reset();
  this.rollingBack_ = false;
};


/**
 * Store all original feature attribute values.
 * @param {ol.Feature} feature Feature.
 * @private
 */
ol.Transaction.prototype.storeOriginal_ = function(feature) {
  var id = goog.getUid(feature).toString();
  if (!this.originals_.hasOwnProperty(id)) {
    var original = new ol.Feature();
    var attributes = feature.getAttributes();
    var attribute;
    for (var key in attributes) {
      attribute = attributes[key];
      original.set(key, attribute instanceof ol.geom.Geometry ?
          attribute.clone() : attribute);
    }
    this.originals_[id] = original;
  }
};


/**
 * Reset all feature attributes to their original values.
 * @param {ol.Feature} feature Feature.
 * @private
 */
ol.Transaction.prototype.restoreOriginal_ = function(feature) {
  var id = goog.getUid(feature).toString();
  if (this.originals_.hasOwnProperty(id)) {
    var original = this.originals_[id];
    var oldValues = feature.getAttributes();
    var newValues = original.getAttributes();
    feature.setValues(newValues);
    for (var key in oldValues) {
      if (!newValues.hasOwnProperty(key)) {
        // TODO: ol.Object.prototype.delete
        feature.set(key, undefined);
      }
    }
    delete this.originals_[id];
  }
};


/**
 * Get a lookup of all inserted features.
 * @return {Object.<string, ol.Feature>} Lookup object keyed by internal id.
 */
ol.Transaction.prototype.getInserts = function() {
  return this.inserts_;
};


/**
 * Get a lookup of all updated features.
 * @return {Object.<string, ol.Feature>} Lookup object keyed by internal id.
 */
ol.Transaction.prototype.getUpdates = function() {
  return this.updates_;
};


/**
 * Get a lookup of all deleted features.
 * @return {Object.<string, ol.Feature>} Lookup object keyed by internal id.
 */
ol.Transaction.prototype.getDeletes = function() {
  return this.deletes_;
};


/**
 * Start listening to a vector source for add, change, and remove events.  Call
 * with `null` to stop listening to the current source.
 * @param {ol.source.Vector} source The target source (or `null` to stop
 *     listening).
 */
ol.Transaction.prototype.setSource = function(source) {
  var oldSource = this.source_;
  if (!goog.isNull(oldSource)) {
    goog.events.unlisten(oldSource, ol.source.VectorEventType.ADD,
        this.handleFeatureAdd_, false, this);
    goog.events.unlisten(oldSource, ol.source.VectorEventType.REMOVE,
        this.handleFeatureRemove_, false, this);
    this.stopMonitoringFeatures_(source.getFeatures());
  }

  this.reset();

  if (source) {
    goog.events.listen(source, ol.source.VectorEventType.ADD,
        this.handleFeatureAdd_, false, this);
    goog.events.listen(source, ol.source.VectorEventType.REMOVE,
        this.handleFeatureRemove_, false, this);
    this.startMonitoringFeatures_(source.getFeatures());
  }
};


/**
 * Handler for featureadd events.
 * @param {ol.source.VectorEvent} evt The vector event (featureadd type).
 * @private
 */
ol.Transaction.prototype.handleFeatureAdd_ = function(evt) {
  this.startMonitoringFeatures_(evt.features);
};


/**
 * Register change listeners on features and start monitoring them.
 * @param {Array.<ol.Feature>} features Featuers.
 * @private
 */
ol.Transaction.prototype.startMonitoringFeatures_ = function(features) {
  var feature, id;
  for (var i = 0, len = features.length; i < len; ++i) {
    feature = features[i];
    goog.events.listen(feature, ol.ObjectEventType.BEFORECHANGE,
        this.handleFeatureChange_, false, this);
    id = goog.getUid(feature).toString();
    this.inserts_[id] = feature;
    delete this.updates_[id];
    delete this.deletes_[id];
  }
};


/**
 * Handler for change events.
 * @param {ol.source.VectorEvent} evt The vector event (featurechange type).
 * @private
 */
ol.Transaction.prototype.handleFeatureChange_ = function(evt) {
  if (!this.rollingBack_) {
    var feature = /** @type {ol.Feature} */ (evt.target);
    var id = goog.getUid(feature).toString();
    if (!this.inserts_.hasOwnProperty(id)) {
      this.storeOriginal_(feature);
      this.updates_[id] = feature;
      delete this.deletes_[id];
    }
  }
};


/**
 * Handler for featureremove events.
 * @param {ol.source.VectorEvent} evt The vector event (featureremove type).
 * @private
 */
ol.Transaction.prototype.handleFeatureRemove_ = function(evt) {
  this.stopMonitoringFeatures_(evt.features);
};


/**
 * Unregister change listeners on features and stop monitoring them
 * @param {Array.<ol.Feature>} features Featuers.
 * @private
 */
ol.Transaction.prototype.stopMonitoringFeatures_ = function(features) {
  var feature, id;
  for (var i = 0, len = features.length; i < len; ++i) {
    feature = features[i];
    goog.events.unlisten(feature, ol.ObjectEventType.BEFORECHANGE,
        this.handleFeatureChange_, false, this);
    id = goog.getUid(feature).toString();
    if (this.inserts_.hasOwnProperty(id)) {
      delete this.inserts_[id];
    } else {
      this.deletes_[id] = feature;
      delete this.originals_[id];
      delete this.updates_[id];
    }
  }
};
