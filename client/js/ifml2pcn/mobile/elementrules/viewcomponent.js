// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map view component
        function (element, model) { return model.isViewComponent(element); },
        function (vcomponent, model) {
            var id = vcomponent.id,
                pid = model.getParentId(vcomponent, 'Application'),
                obj = {};
            obj[id] = {
                cells: (function () {
                    var suffix = '_{' + vcomponent.attributes.name + '}',
                        component = new pcn.elements.PlaceChart({id: id, position: {x: 0, y: 0}, size: {width: 200, height: 320}, name: {text: vcomponent.attributes.name}}),
                        cmodel = new pcn.elements.PlaceChart({id: id + '-Model', position: {x: 20, y: 20}, size: {width: 160, height: 160}, name: {text: 'Model' + suffix, vertical: 'top'}, borders: {left: true}}),
                        init_model = new pcn.links.Link({source: {id: component.id}, target: {id: cmodel.id}}),
                        in_n = new pcn.elements.PlaceChart({id: id + '-In-n', position: {x: 40, y: 40}, name: {text: '\\overline{In}' + suffix, vertical: 'top'}, borders: {left: true}}),
                        in_p = new pcn.elements.PlaceChart({id: id + '-In-p', position: {x: 120, y: 40}, name: {text: 'In' + suffix, vertical: 'top'}, borders: {right: true}}),
                        out_n = new pcn.elements.PlaceChart({id: id + '-Out-n', position: {x: 40, y: 120}, name: {text: '\\overline{Out}' + suffix}, borders: {left: true}}),
                        init_out_n = new pcn.links.Link({source: {id: cmodel.id}, target: {id: out_n.id}}),
                        out_p = new pcn.elements.PlaceChart({id: id + '-Out-p', position: {x: 120, y: 120}, name: {text: 'Out' + suffix, vertical: 'top', horizontal: 'left'}, borders: {right: true}}),
                        compute = new pcn.elements.Transition({position: {x: 80, y: 80}, angle: 135, name: {text: 'compute' + suffix, vertical: 'middle', horizontal: 'right-outer'}, priority: 2}),
                        in_p_to_compute = new pcn.links.Link({source: {id: in_p.id}, target: {id: compute.id}}),
                        out_n_to_compute = new pcn.links.Link({source: {id: out_n.id}, target: {id: compute.id}}),
                        compute_to_in_n = new pcn.links.Link({source: {id: compute.id}, target: {id: in_n.id}}),
                        compute_to_out_p = new pcn.links.Link({source: {id: compute.id}, target: {id: out_p.id}}),
                        cviewmodel = new pcn.elements.PlaceChart({id: id + '-ViewModel', position: {x: 20, y: 220}, size: {width: 160, height: 80}, name: {text: 'ViewModel' + suffix}, borders: {left: true}}),
                        init_viewmodel = new pcn.links.Link({source: {id: component.id}, target: {id: cviewmodel.id}}),
                        view_n = new pcn.elements.PlaceChart({id: id + '-View-n', position: {x: 40, y: 240}, name: {text: '\\overline{View}' + suffix}, borders: {left: true}}),
                        init_view_n = new pcn.links.Link({source: {id: cviewmodel.id}, target: {id: view_n.id}}),
                        view_p = new pcn.elements.PlaceChart({id: id + '-View-p', position: {x: 120, y: 240}, name: {text: 'View' + suffix}, borders: {right: true}}),
                        render = new pcn.elements.Transition({position: {x: 120, y: 180}, angle: 90, name: {text: 'render' + suffix, vertical: 'middle', horizontal: 'left-outer'}, priority: 2}),
                        out_p_to_render = new pcn.links.Link({source: {id: out_p.id}, target: {id: render.id}}),
                        view_n_to_render = new pcn.links.Link({source: {id: view_n.id}, target: {id: render.id}}),
                        render_to_view_p = new pcn.links.Link({source: {id: render.id}, target: {id: view_p.id}}),
                        render_to_out_p = new pcn.links.Link({source: {id: render.id}, target: {id: out_p.id}}),
                        net = [component,
                            cmodel, init_model,
                            in_n, in_p, out_n, out_p, init_out_n,
                            compute,
                            in_p_to_compute, out_n_to_compute, compute_to_in_n, compute_to_out_p,
                            cviewmodel, init_viewmodel,
                            view_n, view_p, init_view_n,
                            render,
                            out_p_to_render, view_n_to_render, render_to_out_p, render_to_view_p];
                    component.embed(cmodel);
                    cmodel.embed(in_n);
                    cmodel.embed(in_p);
                    cmodel.embed(out_n);
                    cmodel.embed(out_p);
                    cmodel.embed(init_out_n);
                    cmodel.embed(compute);
                    in_p.embed(in_p_to_compute);
                    out_n.embed(out_n_to_compute);
                    compute.embed(compute_to_in_n);
                    compute.embed(compute_to_out_p);
                    component.embed(init_model);
                    component.embed(cviewmodel);
                    cviewmodel.embed(view_n);
                    cviewmodel.embed(view_p);
                    cviewmodel.embed(init_view_n);
                    component.embed(init_viewmodel);
                    component.embed(render);
                    out_p.embed(out_p_to_render);
                    view_n.embed(view_n_to_render);
                    render.embed(render_to_view_p);
                    render.embed(render_to_out_p);
                    return net;
                }()),
                position: { row: vcomponent.metadata.graphics.position.y / 5, col: vcomponent.metadata.graphics.position.x / 5 }
            };
            obj[pid + '-Content'] = {children: id};
            return obj;
        }
    ),
    createRule( // map view component
        function (element, model) { return model.isViewComponent(element) && model.isTargetOfDataFlow(element); },
        function (vcomponent, model) {
            var id = vcomponent.id,
                pid = model.getParentId(vcomponent, 'Application'),
                obj = {};
            obj[id] = {cells: [new pcn.links.Link({id: id + '-Model->' + id + '-In-n', source: {id: id + '-Model'}, target: {id: id + '-In-n'}})]};
            obj[id + '-Propagate'] = {
                cells: [
                    new pcn.elements.Transition({id: id + '-Propagate', name: {text: 'propagate_{' + vcomponent.attributes.name + '}'}, priority: 2}),
                    new pcn.links.Link({id: id + '-Propagate->' + id + '-In-p', source: {id: id + '-Propagate'}, target: {id: id + '-In-p'}}),
                    new pcn.links.Link({id: id + '-In-n->' + id + '-Propagate', source: {id: id + '-In-n'}, target: {id: id + '-Propagate'}}),
                    new pcn.links.Link({id: id + '-Propagate->' + id + '-Out-n', source: {id: id + '-Propagate'}, target: {id: id + '-Out-n'}}),
                    new pcn.links.Link({id: id + '-Out-n->' + id + '-Propagate', source: {id: id + '-Out-n'}, target: {id: id + '-Propagate'}})
                ],
                position: {row: vcomponent.metadata.graphics.position.y / 5 - 1, col: vcomponent.metadata.graphics.position.x / 5 - 1}
            };
            obj[pid + '-Content'] = {children: id + '-Propagate'};
            return obj;
        }
    ),
    createRule( // map view component
        function (element, model) { return model.isViewComponent(element) && !model.isTargetOfDataFlow(element); },
        function (vcomponent) {
            var id = vcomponent.id,
                obj = {};
            obj[id] = {cells: [new pcn.links.Link({id: id + '-Model->' + id + '-In-p', source: {id: id + '-Model'}, target: {id: id + '-In-p'}})]};
            return obj;
        }
    )
];
