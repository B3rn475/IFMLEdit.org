// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    createExtender = require('almost-extend').createExtender;

var extend = createExtender({
    type: {
        Leaf: 'layout.Leaf',
        Node: 'layout.Node',
        ForRelation: 'layout.For',
        ElementWithName: ['pcn.PlaceChart', 'pcn.Transition'],
        ElementWithRotation: ['pcn.Transition']
    },
    relation: {
        Parent: {relation: 'layout.Hierarchy', from: 'child', to: 'parent', single: true},
        Children: {relation: 'layout.Hierarchy', from: 'parent', to: 'child'}
    },
});

function toCoordinate(sizes, spacing) {
    var keys = _.map(_.keys(sizes), function (key) { return parseFloat(key); }),
        coordinates = {},
        accumulated;
    keys.sort(function (a, b) { return a - b; });
    if (keys.length) {
        accumulated = -spacing;
        _.forEach(keys, function (key) {
            var size = sizes[key];

            coordinates[key] = accumulated + spacing;

            if (size !== 0) {
                accumulated += spacing + size;
            }
        });
    } else {
        accumulated = 0;
    }
    coordinates.total = accumulated;
    return coordinates;
}

function size(parent, model) {
    if (model.isLeaf(parent)) {
        return;
    }
    var children = _.map(model.getChildren(parent), function (id) {
            return model.toElement(id);
        }),
        padding = parent.attributes.padding || 0,
        spacing = parent.attributes.spacing || 0,
        rows = {},
        columns = {},
        xs,
        ys;
    if (!children.length) {
        parent.attributes.width = 0;
        parent.attributes.height = 0;
    }
    _.forEach(children, function (child) {
        size(child, model);
        var row = child.attributes.row,
            column = child.attributes.column,
            width = child.attributes.width,
            height = child.attributes.height;
        rows[row] = Math.max(rows[row] || 0, height);
        columns[column] = Math.max(columns[column] || 0, width);
    });
    xs = toCoordinate(columns, spacing);
    ys = toCoordinate(rows, spacing);
    parent.attributes.width = xs.total + 2 * padding;
    parent.attributes.height = ys.total + 2 * padding;
    _.forEach(children, function (child) {
        child.attributes.x = xs[child.attributes.column] + padding;
        child.attributes.y = ys[child.attributes.row] + padding;
    });
}

function position(parent, model) {
    var children = _.map(model.getChildren(parent), function (id) {
            return model.toElement(id);
        });
    _.forEach(children, function (child) {
        child.attributes.x += parent.attributes.x;
        child.attributes.y += parent.attributes.y;
        position(child, model);
    });
}

function addMetadata(model) {
    _(model.relations).filter(function (relation) {
        return model.isForRelation(relation);
    }).forEach(function (relation) {
        var layout = model.toElement(relation.layout),
            pcn = model.toElement(relation.pcn);
        pcn.metadata = pcn.metadata || {};
        pcn.metadata.graphics = pcn.metadata.graphics || {};
        pcn.metadata.graphics.position = {
            x: layout.attributes.x,
            y: layout.attributes.y,
        };
        pcn.metadata.graphics.size = {
            width: layout.attributes.width,
            height: layout.attributes.height,
        };
        if (model.isElementWithRotation(pcn)) {
            pcn.metadata.graphics.angle = pcn.metadata.graphics.angle || 0;
        }
        if (model.isElementWithName(pcn)) {
            pcn.metadata.graphics.name = pcn.metadata.graphics.name || {};
            pcn.metadata.graphics.name.vertical = pcn.metadata.graphics.name.vertical || 'bottom';
            pcn.metadata.graphics.name.horizontal = pcn.metadata.graphics.name.horizontal || 'middle';
        }
    }).value();
}

function layout(model) {
    model = extend(model);
    var root = model.toElement('L-Root');
    size(root, model);
    position(root, model);
    addMetadata(model);
}

exports.layout = layout;
