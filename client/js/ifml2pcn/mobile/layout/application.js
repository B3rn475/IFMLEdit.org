// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

var model = [almost.createRule(
    almost.Rule.always,
    function () {
        return {
            elements: [
                {id: 'L-Root', type: 'layout.Node', attributes: {x: 0, y: 0, spacing: 20}},
                {id: 'L-Waiting', type: 'layout.Node', attributes: {row: 1, column: 0, spacing: 20}},
                {id: 'L-Waiting-p', type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: 'Waiting-p', metadata: {graphics: {name: {vertical: 'top'}}}},
                {id: 'L-Waiting-Spacer', type: 'layout.Leaf', attributes: {row: 1, column: 0, width: 0, height: 10}},
                {id: 'L-Waiting-n', type: 'layout.Leaf', attributes: {row: 2, column: 0, width: 40, height: 40}},
                {id: 'L-Open', type: 'layout.Leaf', attributes: {row: 0, column: 1, width: 40, height: 40}},
                {id: 'Open', metadata: {execution: {priority: 0}}},
                {id: 'L-Close', type: 'layout.Leaf', attributes: {row: 2, column: 1, width: 40, height: 40}},
                {id: 'Close', metadata: {graphics: {name: {vertical: 'top'}}, execution: {priority: 0}}},
                {id: 'L-Application-Landmarks', type: 'layout.Node', attributes: {row: 0, column: 1, padding: 10, spacing: 20}},
                {id: 'L-Application', type: 'layout.Node', attributes: {row: 1, column: 1, padding: 20, spacing: 20}},
                {id: 'L-Application-Content', type: 'layout.Node', attributes: {row: 0, column: 1, spacing: 20}},
                {id: 'L-Application-View', type: 'layout.Node', attributes: {row: 0, column: 0, spacing: 20}},
                {id: 'L-Application-View-p', type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: 'L-Application-View-n', type: 'layout.Leaf', attributes: {row: 1, column: 0, width: 40, height: 40}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: 'L-Root', child: 'L-Waiting'},
                {type: 'layout.Hierarchy', parent: 'L-Root', child: 'L-Application-Landmarks'},
                {type: 'layout.Hierarchy', parent: 'L-Root', child: 'L-Application'},
                {type: 'layout.Hierarchy', parent: 'L-Waiting', child: 'L-Waiting-p'},
                {type: 'layout.Hierarchy', parent: 'L-Waiting', child: 'L-Waiting-Spacer'},
                {type: 'layout.Hierarchy', parent: 'L-Waiting', child: 'L-Waiting-n'},
                {type: 'layout.Hierarchy', parent: 'L-Waiting', child: 'L-Open'},
                {type: 'layout.Hierarchy', parent: 'L-Waiting', child: 'L-Close'},
                {type: 'layout.Hierarchy', parent: 'L-Application', child: 'L-Application-Content'},
                {type: 'layout.Hierarchy', parent: 'L-Application', child: 'L-Application-View'},
                {type: 'layout.Hierarchy', parent: 'L-Application-View', child: 'L-Application-View-p'},
                {type: 'layout.Hierarchy', parent: 'L-Application-View', child: 'L-Application-View-n'},
                {type: 'layout.For', layout: 'L-Waiting-p', pcn: 'Waiting-p'},
                {type: 'layout.For', layout: 'L-Waiting-n', pcn: 'Waiting-n'},
                {type: 'layout.For', layout: 'L-Open', pcn: 'Open'},
                {type: 'layout.For', layout: 'L-Close', pcn: 'Close'},
                {type: 'layout.For', layout: 'L-Application', pcn: 'Application'},
                {type: 'layout.For', layout: 'L-Application-View-p', pcn: 'Application-View-p'},
                {type: 'layout.For', layout: 'L-Application-View-n', pcn: 'Application-View-n'},
            ]
        };
    }
)];

var element = [];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
