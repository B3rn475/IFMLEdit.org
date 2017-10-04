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
                'Waiting': {cells: [
                    new pcn.elements.PlaceChart({id: 'Waiting-p', name: {text: 'Waiting', vertical: 'top'}, tokens: 1}),
                    new pcn.elements.PlaceChart({id: 'Waiting-n', name: {text: '\\overline{Waiting}'}, position: {x: 0, y: 100}})
                ], position: {row: 1, col: 0}},
                'Open-Close': {cells: [
                    new pcn.elements.Transition({id: 'Open', name: {text: 'Open'}}),
                    new pcn.elements.Transition({id: 'Close', name: {text: 'Close', vertical: 'top'}, position: {x: 0, y: 100}}),
                    new pcn.links.Link({id: 'Waiting-p->Open', source: {id: 'Waiting-p'}, target: {id: 'Open'}}),
                    new pcn.links.Link({id: 'Open->Waiting-n', source: {id: 'Open'}, target: {id: 'Waiting-n'}}),
                    new pcn.links.Link({id: 'Open->Application', source: {id: 'Open'}, target: {id: 'Application'}}),
                    new pcn.links.Link({id: 'Application->Open', source: {id: 'Application'}, target: {id: 'Open'}}),
                    new pcn.links.Link({id: 'Application->Close', source: {id: 'Application'}, target: {id: 'Close'}}),
                    new pcn.links.Link({id: 'Close->Waiting-p', source: {id: 'Close'}, target: {id: 'Waiting-p'}}),
                    new pcn.links.Link({id: 'Waiting-n->Close', source: {id: 'Waiting-n'}, target: {id: 'Close'}})
                ], position: {row: 1, col: 1}},
                'Application-Landmarks': {position: {row: 0, col: 2}},
                'Application': {
                    cells: [new pcn.elements.PlaceChart({id: 'Application', name: {text: 'Application'}})],
                    children: ['Application-View', 'Application-Content'],
                    position: { row: 1, col: 2}
                },
                'Application-View': {
                    cells: [
                        new pcn.elements.PlaceChart({id: 'Application-View-p', name: {text: 'View_{Application}'}}),
                        new pcn.elements.PlaceChart({id: 'Application-View-n', name: {text: '\\overline{View}_{Application}'}, position: {x: 0, y: 60}, tokens: 1}),
                        new pcn.links.Link({id: 'Application->Application-View-p', source: {id: 'Application'}, target: {id: 'Application-View-p'}}),
                        new pcn.links.Link({id: 'Close->Application-View-n', source: {id: 'Close'}, target: {id: 'Application-View-n'}}),
                    ],
                    position: { row: 0, col: 0 }
                },
                'Application-Content': {position: {row: 0, col: 1}},
                'Model': { children: ['Waiting', 'Open-Close', 'Application', 'Application-Landmarks'] }
            };
        }
    )
];
