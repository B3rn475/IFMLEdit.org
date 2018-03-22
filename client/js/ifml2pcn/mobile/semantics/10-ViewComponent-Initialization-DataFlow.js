// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A ViewComponent \ifml{\namevc}, target of a non empty set
// \ifmldataflowset{\namevc} of DataFlows, maps into:
// \begin{enumerate}
//   \item initialization arcs from the parent that set the \textit{clear} state
//     of its model place charts (one arc adds a token to \pcnnotin{\namevc} and
//     one arc adds a token to \pcnnotout{\namevc}).
//   \item a transition \pcnpropagate{\namevc} that removes a token from
//     \pcnnotout{\namevc} and \pcnnotin{\namevc} and adds a token to
//     \pcnnotout{\namevc} and \pcnin{\namevc}; for each DataFlow
//     \ifml{\namedataflow_i} in \ifmldataflowset{\namevc},
//     \pcnpropagate{\namevc} also removes and adds a token into
//     \pcnview{\namesource_i}, where \ifml{\namesource_i} is the source
//     ViewComponent of \ifml{\namedataflow_i}.
// \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A ViewComponent \ifml{\namevc}, target of a non empty set \ifmldataflowset{\namevc} of DataFlows, maps into:
        return model.isViewComponent(element) && model.isTargetOfDataFlow(element);
    },
    function (component) {
        var id = component.id,
            mid = id + '-Model',
            inid = id + '-In-n',
            ipid = id + '-In-p',
            onid = id + '-Out-n',
            iiid = mid + '->' + inid,
            oiid = mid + '->' + onid,
            pid = id + '-Propagate',
            orid = onid + '->' + pid,
            irid = inid + '->' + pid,
            oaid = pid + '->' + onid,
            iaid = pid + '->' + ipid,
            name = component.attributes.name,
            suffix = '_{' + name + '}';
        return {
            elements: [
                // one arc adds a token to \pcnnotin{\namevc}
                {id: iiid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and one arc adds a token to \pcnnotout{\namevc}).
                {id: oiid, type: 'pcn.Link', attributes: {tokens: 1}},
                // a transition \pcnpropagate{\namevc}
                {id: pid, type: 'pcn.Transition', attributes: {name: 'Propagate' + suffix}},
                // that removes a token from \pcnnotout{\namevc}
                {id: orid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnnotin{\namevc}
                {id: irid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and adds a token to \pcnnotout{\namevc}
                {id: oaid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnin{\namevc};
                {id: iaid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // one arc adds a token to \pcnnotin{\namevc}
                {type: 'pcn.Source', link: iiid, source: mid},
                {type: 'pcn.Target', link: iiid, target: inid},
                // and one arc adds a token to \pcnnotout{\namevc}).
                {type: 'pcn.Source', link: oiid, source: mid},
                {type: 'pcn.Target', link: oiid, target: onid},
                // a transition \pcnpropagate{\namevc} that removes a token from \pcnnotout{\namevc}
                {type: 'pcn.Source', link: orid, source: onid},
                {type: 'pcn.Target', link: orid, target: pid},
                // and \pcnnotin{\namevc}
                {type: 'pcn.Source', link: irid, source: inid},
                {type: 'pcn.Target', link: irid, target: pid},
                // and adds a token to \pcnnotout{\namevc}
                {type: 'pcn.Source', link: oaid, source: pid},
                {type: 'pcn.Target', link: oaid, target: onid},
                // and \pcnin{\namevc};
                {type: 'pcn.Source', link: iaid, source: pid},
                {type: 'pcn.Target', link: iaid, target: ipid},
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        // for each DataFlow \ifml{\namedataflow_i} in \ifmldataflowset{\namevc},
        return model.isDataFlow(element) && model.isViewComponent(model.getTarget(element));
    },
    function (flow, model) {
        // where \ifml{\namesource_i} is the source ViewComponent of \ifml{\namedataflow_i}
        var sid = model.getSourceId(flow),
            tid = model.getTargetId(flow),
            pid = tid + '-Propagate',
            vpid = sid + '-View-p',
            rid = vpid + '->' + pid,
            aid = pid + '->' + vpid;
        return {
            elements: [
                // \pcnpropagate{\namevc} also removes and adds a token into \pcnview{\namesource_i}
                {id: rid, type: 'pcn.Link', attributes: {tokens: 1}},
                {id: aid, type: 'pcn.Link', attributes: {tokens: 1}}
            ],
            relations: [
                // \pcnpropagate{\namevc} also removes and adds a token into \pcnview{\namesource_i}
                {type: 'pcn.Source', link: rid, source: vpid},
                {type: 'pcn.Target', link: rid, target: pid},
                {type: 'pcn.Source', link: aid, source: pid},
                {type: 'pcn.Target', link: aid, target: vpid},
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
