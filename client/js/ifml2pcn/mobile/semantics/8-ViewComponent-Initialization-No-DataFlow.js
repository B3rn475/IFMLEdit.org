// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A ViewComponent \ifml{\namevc} without incoming data flows is initialized in
// the \textit{ready} state, i.e., with defaults arcs from \pcnmodel{\namevc} to
// \pcnin{\namevc} and \pcnnotout{\namevc}.

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A ViewComponent \ifml{\namevc} without incoming data flows
        return model.isViewComponent(element) && !model.isTargetOfDataFlow(element);
    },
    function (component) {
        var id = component.id,
            mid = id + '-Model',
            ipid = id + '-In-p',
            onid = id + '-Out-n',
            iiid = mid + '->' + ipid,
            oiid = mid + '->' + onid;
        return {
            elements: [
                // with defaults arcs from \pcnmodel{\namevc} to \pcnin{\namevc}
                {id: iiid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnnotout{\namevc}
                {id: oiid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // with defaults arcs from \pcnmodel{\namevc} to \pcnin{\namevc}
                {type: 'pcn.Source', link: iiid, source: mid},
                {type: 'pcn.Target', link: iiid, target: ipid},
                // and \pcnnotout{\namevc}
                {type: 'pcn.Source', link: oiid, source: mid},
                {type: 'pcn.Target', link: oiid, target: onid},
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
