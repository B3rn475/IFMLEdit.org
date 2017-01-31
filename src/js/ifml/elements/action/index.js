/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    joint = require('joint');

exports.Action = joint.shapes.basic.Generic.extend({
    markup: require('./markup.svg'),

    defaults: joint.util.deepSupplement({
        type: 'ifml.Action',
        size: {width: 75, height: 50},
        name: 'Action',
        attrs: {
            '.': {magnet: 'passive'},
            '.ifml-action-reference-rect' : {'follow-scale': 'auto'},
            '.ifml-action-background-rect': {
                'ref-x': 7.5,
                'ref-y': 0,
                'ref-width': -15,
                'ref-height': 1,
                ref: '.ifml-action-reference-rect'
            },
            '.ifml-action-background-arrow-left': {
                'ref-x': 0,
                'ref-y': 0,
                'ref-height': 1,
                ref: '.ifml-action-reference-rect'
            },
            '.ifml-action-background-arrow-right-wrapper': {
                'ref-dx': -10,
                ref: '.ifml-action-reference-rect'
            },
            '.ifml-action-background-arrow-right': {
                'ref-height': 1,
                ref: '.ifml-action-reference-rect'
            },
            '.name': {
                'ref-x': 0.5,
                'ref-y': 0.5,
                'y-alignment': 'middle',
                'x-alignment': 'middle',
                ref: '.ifml-action-reference-rect'
            }
        }
    }, joint.shapes.basic.Generic.prototype.defaults),

    minsize: {width: 75, height: 50},
    padding: {top: 0, right: 0, bottom: 0, left: 0},
    resizable: true,
    isContraint: true,
    requireEmbedding: false,
    fullyContained: true,
    containers: ['ifml.ViewContainer'],

    editable: function () {
        var graph = this.graph,
            filter = function (id) {
                switch (graph.getCell(id).get('type')) {
                case 'ifml.Event':
                    return true;
                default:
                    return false;
                }
            },
            display = function (id) { return graph.getCell(id).prop('name/text'); },
            editables = _.chain([
                {property: 'name', name: 'Name', type: 'string'},
                {property: 'parameters', name: 'Parameters', type: 'stringset'},
                {property: 'results', name: 'Results', type: 'stringset'}
            ]);
        if (graph) {
            editables = editables.concat(
                {property: 'embeds', name: 'Events', type: 'elementslist', filter: filter, display: display}
            );
        }
        return editables.value();
    },

    initialize: function () {
        this.on('change:size', this._sizeChanged, this);
        this.on('change:name', this._nameChanged, this);
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this._sizeChanged();
        this._nameChanged();
    },

    _sizeChanged: function () {
        var size = this.get('size'),
            minsize = this.minsize;
        if (size.width < minsize.width || size.height < minsize.height) {
            this.resize(Math.max(size.width, minsize.width), Math.max(size.height, minsize.height));
        }
    },

    _nameChanged: function () {
        this.attr({'.name': {text: this.get('name')}});
    },

    inputs: function () {
        return _(this.get('parameters') || []).sort().uniq(true).value();
    },

    outputs: function () {
        return _(this.get('results') || []).sort().uniq(true).value();
    }
});
