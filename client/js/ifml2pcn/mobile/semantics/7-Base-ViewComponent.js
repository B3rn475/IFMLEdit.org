// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

// A ViewComponent \ifml{\namechild} child of a parent ViewContainer
// \ifml{\nameparent} maps to:
// \begin{enumerate}
//   \item a place chart \pcn{\namechild}, child of \pcn{\nameparent},
//     initialized by default from \pcn{\nameparent}.
//   \item two children place charts of \pcn{\namechild}: \pcnmodel{\namechild}
//     and \pcnviewmodel{\namechild}, initialized by default from \namechild.
//   \item four bottom place charts \pcnin{\namechild}, \pcnnotin{\namechild},
//     \pcnout{\namechild} and \pcnnotout{\namechild}, children of
//     \pcnmodel{\namechild}.
//   \item a transition \pcncompute{\namechild}, which removes a token from
//     \pcnin{\namechild} and \pcnnotout{\namechild} and inserts a token into
//     \pcnnotin{\namechild} and \pcnout{\namechild}.
//   \item two bottom place charts \pcnview{\namechild} and
//     \pcnnotview{\namechild}, children of \pcnviewmodel{\namechild}.
//     \pcnnotview{\namechild} is initialized by default from
//     \pcnviewmodel{\namechild}.
//   \item a transition \pcnrender{\namechild}, which removes a token from
//     \pcnnotview{\namechild} and \pcnout{\namechild} and inserts a token into
//     \pcnview{\namechild} and \pcnout{\namechild}.
//  \end{enumerate}

var model = [];

var element = [almost.createRule(
    function (element, model) {
        // A ViewComponent \ifml{\namechild} child of a parent ViewContainer \ifml{\nameparent} maps to:
        return model.isViewComponent(element);
    },
    function (component, model) {
        var id = model.toId(component),
            pid = model.getParentId(component),
            mid = id + '-Model',
            ipid = id + '-In-p',
            inid = id + '-In-n',
            opid = id + '-Out-p',
            onid = id + '-Out-n',
            cid = id + '-Compute',
            vmid = id + '-ViewModel',
            vpid = id + '-View-p',
            vnid = id + '-View-n',
            rid = id + '-Render',
            iid = pid + '->' + id,
            miid = id + '->' + mid,
            vmiid = id + '->' + vmid,
            cirid = ipid + '->' + cid,
            corid = onid + '->' + cid,
            ciaid = cid + '->' + inid,
            coaid = cid + '->' + opid,
            vniid = vmid + '->' + vnid,
            rvrid = vnid + '->' + rid,
            rorid = opid + '->' + rid,
            rvaid = rid + '->' + vpid,
            roaid = rid + '->' + opid,
            name = component.attributes.name,
            suffix = '_{' + name + '}';
        return {
            elements: [
                // a place chart \pcn{\namechild}, child of \pcn{\nameparent},
                {id: id, type: 'pcn.PlaceChart', attributes: {name: name}},
                // initialized by default from \pcn{\nameparent}.
                {id: iid, type: 'pcn.Link', attributes: {tokens: 1}},
                // two children place charts of \pcn{\namechild}: \pcnmodel{\namechild}
                {id: mid, type: 'pcn.PlaceChart', attributes: {name: 'Model' + suffix}},
                // and \pcnviewmodel{\namechild},
                {id: vmid, type: 'pcn.PlaceChart', attributes: {name: 'ViewModel' + suffix}},
                //  initialized by default from \namechild.
                {id: miid, type: 'pcn.Link', attributes: {tokens: 1}},
                {id: vmiid, type: 'pcn.Link', attributes: {tokens: 1}},
                // bottom place charts \pcnin{\namechild},
                {id: ipid, type: 'pcn.PlaceChart', attributes: {name: 'In' + suffix}},
                // \pcnnotin{\namechild},
                {id: inid, type: 'pcn.PlaceChart', attributes: {name: '\\overline{In}' + suffix}},
                // \pcnout{\namechild}
                {id: opid, type: 'pcn.PlaceChart', attributes: {name: 'Out' + suffix}},
                // and \pcnnotout{\namechild}, children of \pcnmodel{\namechild}.
                {id: onid, type: 'pcn.PlaceChart', attributes: {name: '\\overline{Out}' + suffix}},
                // a transition \pcncompute{\namechild},
                {id: cid, type: 'pcn.Transition', attributes: {name: 'Compute' + suffix}},
                // which removes a token from \pcnin{\namechild}
                {id: cirid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnout{\namechild}
                {id: corid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and inserts a token into \pcnnotin{\namechild}
                {id: ciaid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnout{\namechild}.
                {id: coaid, type: 'pcn.Link', attributes: {tokens: 1}},
                // two bottom place charts \pcnview{\namechild}
                {id: vpid, type: 'pcn.PlaceChart', attributes: {name: 'View' + suffix}},
                // and \pcnnotview{\namechild}, children of \pcnviewmodel{\namechild}.
                {id: vnid, type: 'pcn.PlaceChart', attributes: {name: '\\overline{View}' + suffix}},
                // \pcnnotview{\namechild} is initialized by default from \pcnviewmodel{\namechild}.
                {id: vniid, type: 'pcn.Link', attributes: {tokens: 1}},
                // a transition \pcnrender{\namechild},
                {id: rid, type: 'pcn.Transition', attributes: {name: 'Render' + suffix}},
                // which removes a token from \pcnnotview{\namechild}
                {id: rvrid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnout{\namechild}
                {id: rorid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and inserts a token into \pcnview{\namechild}
                {id: rvaid, type: 'pcn.Link', attributes: {tokens: 1}},
                // and \pcnout{\namechild}.
                {id: roaid, type: 'pcn.Link', attributes: {tokens: 1}},
            ],
            relations: [
                // a place chart \pcn{\namechild}, child of \pcn{\nameparent},
                {type: 'pcn.Hierarchy', parent: pid, child: id},
                // initialized by default from \pcn{\nameparent}.
                {type: 'pcn.Source', link: iid, source: pid},
                {type: 'pcn.Target', link: iid, target: id},
                // two children place charts of \pcn{\namechild}: \pcnmodel{\namechild}
                {type: 'pcn.Hierarchy', parent: id, child: mid},
                // and \pcnviewmodel{\namechild},
                {type: 'pcn.Hierarchy', parent: id, child: vmid},
                // initialized by default from \namechild.
                {type: 'pcn.Source', link: miid, source: id},
                {type: 'pcn.Target', link: miid, target: mid},
                {type: 'pcn.Source', link: vmiid, source: id},
                {type: 'pcn.Target', link: vmiid, target: vmid},
                // four bottom place charts \pcnin{\namechild},
                {type: 'pcn.Hierarchy', parent: mid, child: ipid},
                // \pcnnotin{\namechild},
                {type: 'pcn.Hierarchy', parent: mid, child: inid},
                // \pcnout{\namechild}
                {type: 'pcn.Hierarchy', parent: mid, child: opid},
                // and \pcnnotout{\namechild}, children of \pcnmodel{\namechild}.
                {type: 'pcn.Hierarchy', parent: mid, child: onid},
                // transition \pcncompute{\namechild}, which removes a token from \pcnin{\namechild}
                {type: 'pcn.Source', link: cirid, source: ipid},
                {type: 'pcn.Target', link: cirid, target: cid},
                // and \pcnnotout{\namechild}
                {type: 'pcn.Source', link: corid, source: onid},
                {type: 'pcn.Target', link: corid, target: cid},
                // and inserts a token into \pcnnotin{\namechild}
                {type: 'pcn.Source', link: ciaid, source: cid},
                {type: 'pcn.Target', link: ciaid, target: inid},
                // and \pcnout{\namechild}.
                {type: 'pcn.Source', link: coaid, source: cid},
                {type: 'pcn.Target', link: coaid, target: opid},
                // two bottom place charts \pcnview{\namechild} and \pcnnotview{\namechild},
                // children of \pcnviewmodel{\namechild}.
                {type: 'pcn.Hierarchy', parent: vmid, child: vpid},
                {type: 'pcn.Hierarchy', parent: vmid, child: vnid},
                // \pcnnotview{\namechild} is initialized by default from \pcnviewmodel{\namechild}.
                {type: 'pcn.Source', link: vniid, source: vmid},
                {type: 'pcn.Target', link: vniid, target: vnid},
                // a transition \pcnrender{\namechild}, which removes a token from \pcnnotview{\namechild}
                {type: 'pcn.Source', link: rvrid, source: vnid},
                {type: 'pcn.Target', link: rvrid, target: rid},
                // and \pcnout{\namechild}
                {type: 'pcn.Source', link: rorid, source: opid},
                {type: 'pcn.Target', link: rorid, target: rid},
                // and inserts a token into \pcnview{\namechild}
                {type: 'pcn.Source', link: rvaid, source: rid},
                {type: 'pcn.Target', link: rvaid, target: vpid},
                // and \pcnout{\namechild}.
                {type: 'pcn.Source', link: roaid, source: rid},
                {type: 'pcn.Target', link: roaid, target: opid}
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
