// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var joint = require('joint'),
    elements = require('../elements').elements,
    links = require('../links').links;

function createComponent(options) {
    options = options || {};
    var id = options.id || joint.util.uuid(),
        name = options.name || 'Component',
        suffix = '_{' + name + '}',
        modelstate = options.modelstate || 'ready',
        viewmodelstate = options.modelstate || 'invalidated',
        component = new elements.PlaceChart({id: id, position: {x: 0, y: 0}, size: {width: 200, height: 320}, name: {text: name}}),
        model = new elements.PlaceChart({id: id + '-model', position: {x: 20, y: 20}, size: {width: 160, height: 160}, name: {text: 'Model' + suffix, vertical: 'top'}, borders: {left: true}}),
        init_model = new links.Link({source: {id: component.id}, target: {id: model.id}}),
        in_n = new elements.PlaceChart({id: id + '-in-n', position: {x: 40, y: 40}, name: {text: '\\overline{In}' + suffix, vertical: 'top'}, borders: {left: true}}),
        init_in_n = new links.Link({source: {id: model.id}, target: {id: in_n.id}}),
        in_p = new elements.PlaceChart({id: id + '-in-p', position: {x: 120, y: 40}, name: {text: 'In' + suffix, vertical: 'top'}, borders: {right: true}}),
        init_in_p = new links.Link({source: {id: model.id}, target: {id: in_p.id}}),
        out_n = new elements.PlaceChart({id: id + '-out-n', position: {x: 40, y: 120}, name: {text: '\\overline{Out}' + suffix}, borders: {left: true}}),
        init_out_n = new links.Link({source: {id: model.id}, target: {id: out_n.id}}),
        out_p = new elements.PlaceChart({id: id + '-out-p', position: {x: 120, y: 120}, name: {text: 'Out' + suffix, vertical: 'top', horizontal: 'left'}, borders: {right: true}}),
        init_out_p = new links.Link({source: {id: model.id}, target: {id: out_p.id}}),
        compute = new elements.Transition({position: {x: 80, y: 80}, angle: 135, name: {text: 'compute' + suffix, vertical: 'middle', horizontal: 'right-outer'}}),
        in_p_to_compute = new links.Link({source: {id: in_p.id}, target: {id: compute.id}}),
        out_n_to_compute = new links.Link({source: {id: out_n.id}, target: {id: compute.id}}),
        compute_to_in_n = new links.Link({source: {id: compute.id}, target: {id: in_n.id}}),
        compute_to_out_p = new links.Link({source: {id: compute.id}, target: {id: out_p.id}}),
        viewmodel = new elements.PlaceChart({id: id + '-viewmodel', position: {x: 20, y: 220}, size: {width: 160, height: 80}, name: {text: 'ViewModel' + suffix}, borders: {left: true}}),
        init_viewmodel = new links.Link({source: {id: component.id}, target: {id: viewmodel.id}}),
        view_n = new elements.PlaceChart({id: id + '-view-n', position: {x: 40, y: 240}, name: {text: '\\overline{View}' + suffix}, borders: {left: true}}),
        init_view_n = new links.Link({source: {id: viewmodel.id}, target: {id: view_n.id}}),
        view_p = new elements.PlaceChart({id: id + '-view-p', position: {x: 120, y: 240}, name: {text: 'View' + suffix}, borders: {right: true}}),
        init_view_p = new links.Link({source: {id: viewmodel.id}, target: {id: view_p.id}}),
        render = new elements.Transition({position: {x: 120, y: 180}, angle: 90, name: {text: 'render' + suffix, vertical: 'middle', horizontal: 'left-outer'}}),
        out_p_to_render = new links.Link({source: {id: out_p.id}, target: {id: render.id}}),
        view_n_to_render = new links.Link({source: {id: view_n.id}, target: {id: render.id}}),
        render_to_view_p = new links.Link({source: {id: render.id}, target: {id: view_p.id}}),
        render_to_out_p = new links.Link({source: {id: render.id}, target: {id: out_p.id}}),
        net = [component,
            model, init_model,
            in_n, in_p, out_n, out_p,
            compute,
            in_p_to_compute, out_n_to_compute, compute_to_in_n, compute_to_out_p,
            viewmodel, init_viewmodel,
            view_n, view_p,
            init_view_n,
            render,
            out_p_to_render, view_n_to_render, render_to_out_p, render_to_view_p];
    component.embed(model);
    model.embed(in_n);
    model.embed(in_p);
    model.embed(out_n);
    model.embed(out_p);
    model.embed(compute);
    in_p.embed(in_p_to_compute);
    out_n.embed(out_n_to_compute);
    compute.embed(compute_to_in_n);
    compute.embed(compute_to_out_p);
    component.embed(init_model);
    component.embed(viewmodel);
    viewmodel.embed(view_n);
    viewmodel.embed(view_p);
    component.embed(init_viewmodel);
    component.embed(render);
    out_p.embed(out_p_to_render);
    view_n.embed(view_n_to_render);
    render.embed(render_to_view_p);
    render.embed(render_to_out_p);
    switch (modelstate) {
    case 'computed':
        model.embed(init_in_n);
        model.embed(init_out_p);
        net.push(init_in_n);
        net.push(init_out_p);
        break;
    case 'clear':
        model.embed(init_in_n);
        model.embed(init_out_n);
        net.push(init_in_n);
        net.push(init_out_n);
        break;
    case 'ready':
        model.embed(init_in_p);
        model.embed(init_out_n);
        net.push(init_in_p);
        net.push(init_out_n);
        break;
    }
    switch (viewmodelstate) {
    case 'invalidated':
        model.embed(init_view_n);
        net.push(init_view_n);
        break;
    case 'visible':
        model.embed(init_view_p);
        net.push(init_view_p);
        break;
    }
    return net;
}

exports.createComponent = createComponent;
