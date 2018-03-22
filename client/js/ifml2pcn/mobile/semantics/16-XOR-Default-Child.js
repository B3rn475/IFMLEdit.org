// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A default ViewContainer \ifml{\namechild} child of a XOR ViewContainer
// \ifml{\nameparent} maps to an initialization arc from the place chart
// \pcn{\nameparent} to the place chart \pcn{\namechild}.

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A default ViewContainer \ifml{\namechild} child of a XOR ViewContainer \ifml{\nameparent} maps to
        return model.isViewContainer(element) && model.isDefault(element) && model.isXOR(model.getParent(element), true); // Rule 3
    },
    function (container, model) {
        var id = container.id,
            pid = model.getParentId(container, 'Application'), // Rule 3
            iid = pid + '->' + id;
        return {
            elements: [
                // an initialization arc from the place chart \pcn{\nameparent} to the place chart \pcn{\namechild}.
                {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an initialization arc from the place chart \pcn{\nameparent} to the place chart \pcn{\namechild}.
                {type: 'pcn.Source', link: iid, source: pid},
                {type: 'pcn.Target', link: iid, target: id}
            ]
        };
    }
)];

var relation = [];

exports.rules = {
    model: model,
    element: element,
    relation: relation
};
