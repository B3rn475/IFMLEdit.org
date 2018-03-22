// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A non default ViewContainer \ifml{\namechild} child of a XOR ViewContainer
// \ifml{\nameparent} maps to an initialization arc from the place chart
// \pcn{\nameparent} to \pcnnotview{\namechild}.

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A non default ViewContainer \ifml{\namechild} child of a XOR ViewContainer \ifml{\nameparent} maps to
        return model.isViewContainer(element) && !model.isDefault(element) && model.isXOR(model.getParent(element), true); // Rule 4
    },
    function (container, model) {
        var vid = model.toId(container) + '-View-n',
            pid = model.getParentId(container, 'Application'),  // Rule 4
            iid = pid + '->' + vid;
        return {
            elements: [
                // an initialization arc from the place chart \pcn{\nameparent} to \pcnnotview{\namechild}.
                {id: iid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // an initialization arc from the place chart \pcn{\nameparent} to \pcnnotview{\namechild}.
                {type: 'pcn.Source', link: iid, source: pid},
                {type: 'pcn.Target', link: iid, target: vid}
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
