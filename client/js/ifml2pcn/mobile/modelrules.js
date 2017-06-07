// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var pcn = require('../../pcn').pcn,
    almost = require('almost'),
    Rule = almost.Rule,
    createRule = almost.createRule;

exports.rules = [
    createRule(
        Rule.always,
        function () {
            return {
                'waiting': {cells: [
                    new pcn.elements.PlaceChart({id: 'waiting-p', name: {text: 'Waiting', vertical: 'top'}, tokens: 1}),
                    new pcn.elements.PlaceChart({id: 'waiting-n', name: {text: '\\overline{Waiting}'}, position: {x: 0, y: 100}})
                ], position: {row: 1, col: 0}},
                'open-close': {cells: [
                    new pcn.elements.Transition({id: 'open', name: {text: 'open'}}),
                    new pcn.elements.Transition({id: 'close', name: {text: 'close', vertical: 'top'}, position: {x: 0, y: 100}}),
                    new pcn.links.Link({id: 'waiting-p->open', source: {id: 'waiting-p'}, target: {id: 'open'}}),
                    new pcn.links.Link({id: 'open->waiting-n', source: {id: 'open'}, target: {id: 'waiting-n'}}),
                    new pcn.links.Link({id: 'open->application', source: {id: 'open'}, target: {id: 'application'}}),
                    new pcn.links.Link({id: 'application->open', source: {id: 'application'}, target: {id: 'open'}}),
                    new pcn.links.Link({id: 'application->close', source: {id: 'application'}, target: {id: 'close'}}),
                    new pcn.links.Link({id: 'close->waiting-p', source: {id: 'close'}, target: {id: 'waiting-p'}}),
                    new pcn.links.Link({id: 'waiting-n->close', source: {id: 'waiting-n'}, target: {id: 'close'}})
                ], position: {row: 1, col: 1}},
                'application-landmarks': {position: {row: 0, col: 2}},
                'application': {
                    cells: [new pcn.elements.PlaceChart({id: 'application', name: {text: 'Application'}})],
                    children: ['application-view', 'application-content'],
                    position: { row: 1, col: 2}
                },
                'application-view': {
                    cells: [
                        new pcn.elements.PlaceChart({id: 'application-view-p', name: {text: 'View_{Application}'}}),
                        new pcn.elements.PlaceChart({id: 'application-view-n', name: {text: '\\overline{View}_{Application}'}, position: {x: 0, y: 60}, tokens: 1}),
                        new pcn.links.Link({id: 'application->application-view-p', source: {id: 'application'}, target: {id: 'application-view-p'}}),
                        new pcn.links.Link({id: 'close->application-view-n', source: {id: 'close'}, target: {id: 'application-view-n'}}),
                    ],
                    position: { row: 0, col: 0 }
                },
                'application-content': {position: {row: 0, col: 1}},
                'model': { children: ['waiting', 'open-close', 'application', 'application-landmarks'] }
            };
        }
    )
];
