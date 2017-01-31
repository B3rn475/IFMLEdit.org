// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    document = require('document'),
    path = require('path'),
    joint = require('joint'),
    Blob = require('Blob'),
    saveAs = require('FileSaver'),
    FileReader = require('FileReader'),
    createBoard = require('m-transform.js.joint').createBoard,
    ifml = require('./ifml').ifml,
    defaultLink = require('./defaultlink').defaultLink,
    createElementsMenu = require('m-transform.js.joint').createElementsMenu,
    createModalEdit = require('m-transform.js.joint').createModalEdit,
    createModalExamples = require('./modalexamples').ModalExamples,
    examples = require('./examples').examples;

function toBuilder(Element) { return function () { return [new Element()]; }; }

var ifmlModel = new joint.dia.Graph(),
    ifmlBuilders = _.values(ifml.elements).map(toBuilder).concat(_.values(ifml.nets)),
    ifmlBoard = createBoard({
        el: '#ifml > .board',
        model: ifmlModel,
        defaultLink: defaultLink
    }),
    ifmlMenu = createElementsMenu({
        container: '#ifml > .sidebar > ul',
        template: '<a class="list-group-item m-transform-place-holder"></a>',
        builders: ifmlBuilders,
        createItemDragger: ifmlBoard.createItemDragger,
        width: 170
    });

ifmlBoard.zoomE();

function editElement(cellView) {
    createModalEdit({cell: cellView.model});
}

ifmlBoard.on('cell:edit cell:pointerdblclick link:options', editElement);

$('#ifml > .sidebar .png-download').click(function () {
    ifmlBoard.download();
    return false;
});

$('#ifml > .sidebar .model-download').click(function () {
    var model = ifml.toJSON(ifmlModel);
    saveAs(new Blob([JSON.stringify(model)], {type: 'application/json'}), 'ifml.json');
    return false;
});

$('#ifml > input[type=file]').change(function () {
    var reader = new FileReader();

    reader.onload = function (e) {
        ifmlModel.clear();
        try {
            var start = new Date();
            ifmlModel.addCells(ifml.fromJSON(JSON.parse(e.target.result)));
            $.notify({message: 'File loaded in ' + (Math.floor((new Date() - start) / 10) / 100) + ' seconds!'}, {allow_dismiss: true, type: 'success'});
        } catch (exception) {
            ifmlModel.clear();
            $.notify({message: 'Invalid input file!'}, {allow_dismiss: true, type: 'danger'});
            return;
        }
        ifmlBoard.zoomE();
    };

    reader.onerror = function () {
        $.notify({message: 'Error loading file!'}, {allow_dismiss: true, type: 'danger'});
    };

    reader.readAsText(this.files[0]);

    this.value = '';
});

$('#ifml > .sidebar .model-load').click(function () {
    $('#ifml > input[type=file]').click();
    return false;
});

$('#ifml > .sidebar .modal-example').click(function () {
    createModalExamples({examples: examples, load: function (example) {
        $.getJSON(example.url, function (result) {
            ifmlModel.clear();
            try {
                var start = new Date();
                ifmlModel.addCells(ifml.fromJSON(result));
                $.notify({message: 'File loaded in ' + (Math.floor((new Date() - start) / 10) / 100) + ' seconds!'}, {allow_dismiss: true, type: 'success'});
            } catch (exception) {
                ifmlModel.clear();
                $.notify({message: 'Invalid input file!'}, {allow_dismiss: true, type: 'danger'});
                return;
            }
            ifmlBoard.zoomE();
        });
    }});
    return false;
});
