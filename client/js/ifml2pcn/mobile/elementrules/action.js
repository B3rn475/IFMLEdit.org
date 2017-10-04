// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map Data Flow
        function (element, model) { return model.isAction(element); },
        function (action, model) {
            var id = action.id,
                name = action.attributes.name,
                suffix = '_{' + name + '}',
                event = model.getActionSource(action),
                cid = model.getActionParentId(action),
                obj = {};
            obj[cid + '-Content'] = {children: id};
            obj[id] = {
                cells: new pcn.elements.PlaceChart({id: id, name: {text: name}}),
                children: [id + '-Running-p', id + '-Running-n'],
                position: {row: event.metadata.graphics.position.y / 5, col: event.metadata.graphics.position.x / 5 + 1}
            };
            obj[id + '-Running-p'] = {
                cells: [
                    new pcn.elements.PlaceChart({id: id + '-Running-p', name: {text: 'Running' + suffix}}),
                    new pcn.links.Link({id: id + '->' + id + '-Running-p', source: {id: id}, target: {id: id + '-Running-p'}})
                ],
                position: {row: 0, col: 0}
            };
            obj[id + '-Running-n'] = {
                cells: new pcn.elements.PlaceChart({id: id + '-Running-n', name: {text: '\\overline{Running}' + suffix}}),
                position: {row: 1, col: 0}
            };
            return obj;
        }
    )
];
