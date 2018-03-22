// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost');

var model = [];

var element = [almost.createRule(
    function (element, model) {
        return model.isViewComponent(element);
    },
    function (component, model) {
        var id = component.id,
            pid = model.getParentId(component),
            mid = id + '-Model',
            ipid = id + '-In-p',
            inid = id + '-In-n',
            cid = id + '-Compute',
            opid = id + '-Out-p',
            onid = id + '-Out-n',
            rid = id + '-Render',
            vmid = id + '-ViewModel',
            vpid = id + '-View-p',
            vnid = id + '-View-n',
            lid = 'L-' + id,
            lpcid = 'L-' + pid + '-Content',
            lgid = lid + '-Group',
            lmid = lid + '-Model',
            lipid = lid + '-In-p',
            linid = lid + '-In-n',
            lcid = lid + '-Compute',
            lopid = lid + '-Out-p',
            lonid = lid + '-Out-n',
            lrgid = lid + '-Render-Group',
            lrsid = lid + '-Render-Spacer',
            lrid = lid + '-Render',
            lvmid = lid + '-ViewModel',
            lvpid = lid + '-View-p',
            lvsid = lid + '-View-Spacer',
            lvnid = lid + '-View-n',
            column = component.metadata.graphics.position.x,
            row = component.metadata.graphics.position.y;
        return {
            elements: [
                {id: lgid, type: 'layout.Node', attributes: {row: row, column: column, spacing: 20}},
                {id: lid, type: 'layout.Node', attributes: {row: 1, column: 0, padding: 20}},
                {id: lmid, type: 'layout.Node', attributes: {row: 0, column: 0, padding: 20}},
                {id: linid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: inid, metadata: {graphics: {name: {vertical: 'top'}}}},
                {id: lipid, type: 'layout.Leaf', attributes: {row: 0, column: 2, width: 40, height: 40}},
                {id: ipid, metadata: {graphics: {name: {vertical: 'top'}}}},
                {id: lcid, type: 'layout.Leaf', attributes: {row: 1, column: 1, width: 40, height: 40}},
                {id: cid, metadata: {graphics: {parent: mid, angle: -45, name: {vertical: 'middle', horizontal: 'right-outer'}}, execution: {priority: 2}}},
                {id: lonid, type: 'layout.Leaf', attributes: {row: 2, column: 0, width: 40, height: 40}},
                {id: lopid, type: 'layout.Leaf', attributes: {row: 2, column: 2, width: 40, height: 40}},
                {id: opid, metadata: {graphics: {name: {vertical: 'top', horizontal: 'left'}}}},
                {id: lrgid, type: 'layout.Node', attributes: {row: 1, column: 0}},
                {id: lrsid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 100, height: 0}},
                {id: lrid, type: 'layout.Leaf', attributes: {row: 0, column: 1, width: 40, height: 40}},
                {id: rid, metadata: {graphics: {parent: id, angle: 90, name: {vertical: 'middle', horizontal: 'left-outer'}}, execution: {priority: 2}}},
                {id: lvmid, type: 'layout.Node', attributes: {row: 2, column: 0, padding: 20}},
                {id: lvnid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: lvsid, type: 'layout.Leaf', attributes: {row: 0, column: 1, width: 40, height: 0}},
                {id: lvpid, type: 'layout.Leaf', attributes: {row: 0, column: 2, width: 40, height: 40}},
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lpcid, child: lgid},
                {type: 'layout.Hierarchy', parent: lgid, child: lid},
                {type: 'layout.Hierarchy', parent: lid, child: lmid},
                {type: 'layout.Hierarchy', parent: lmid, child: lipid},
                {type: 'layout.Hierarchy', parent: lmid, child: linid},
                {type: 'layout.Hierarchy', parent: lmid, child: lcid},
                {type: 'layout.Hierarchy', parent: lmid, child: lopid},
                {type: 'layout.Hierarchy', parent: lmid, child: lonid},
                {type: 'layout.Hierarchy', parent: lid, child: lrgid},
                {type: 'layout.Hierarchy', parent: lrgid, child: lrsid},
                {type: 'layout.Hierarchy', parent: lrgid, child: lrid},
                {type: 'layout.Hierarchy', parent: lid, child: lvmid},
                {type: 'layout.Hierarchy', parent: lvmid, child: lvpid},
                {type: 'layout.Hierarchy', parent: lvmid, child: lvsid},
                {type: 'layout.Hierarchy', parent: lvmid, child: lvnid},
                {type: 'layout.For', layout: lid, pcn: id},
                {type: 'layout.For', layout: lmid, pcn: mid},
                {type: 'layout.For', layout: lipid, pcn: ipid},
                {type: 'layout.For', layout: linid, pcn: inid},
                {type: 'layout.For', layout: lcid, pcn: cid},
                {type: 'layout.For', layout: lopid, pcn: opid},
                {type: 'layout.For', layout: lonid, pcn: onid},
                {type: 'layout.For', layout: lrid, pcn: rid},
                {type: 'layout.For', layout: lvmid, pcn: vmid},
                {type: 'layout.For', layout: lvpid, pcn: vpid},
                {type: 'layout.For', layout: lvnid, pcn: vnid}
            ]
        };
    }
), almost.createRule(
    function (element, model) {
        return model.isViewComponent(element) && model.isTargetOfDataFlow(element);
    },
    function (component, model) {
        var id = component.id,
            pid = model.getParentId(component, 'Application'),
            tid = id + '-Propagate',
            lid = 'L-' + id,
            lgid = lid + '-Group',
            ltid = lid + '-Propagate';

        return {
            elements: [
                {id: ltid, type: 'layout.Leaf', attributes: {row: 0, column: 0, width: 40, height: 40}},
                {id: tid, metadata: {graphics: {parent: pid}, execution: {priority: 2}}}
            ],
            relations: [
                {type: 'layout.Hierarchy', parent: lgid, child: ltid},
                {type: 'layout.For', layout: ltid, pcn: tid},
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
