// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    ko = require('knockout'),
    document = require('document');

ko.bindingHandlers.bootstrapCarousel = {
    init: function (element) {
        $(element).carousel();
    }
};

function ExamplesViewModel(options, close) {
    var self = this;
    self.examples = ko.observableArray(options.examples);
    self.load = function () {
        options.load(this);
        self.close();
    };
    self.close = close;
}

function ModalExamples(options) {
    if (!(this instanceof ModalExamples)) { return new ModalExamples(options); }
    options = options || {};

    if (options.examples === undefined) { throw new Error('missing examples option'); }
    if (!_.isArray(options.examples)) { throw new Error('examples should be an array'); }
    if (options.load === undefined) { throw new Error('missing load option'); }
    if (typeof options.load !== 'function') { throw new Error('load should be a function'); }

    var examples = options.examples,
        load = options.load,
        el = $(require('./modal.html'));

    $(document.body).append(el);

    function tearDown() {
        el.remove();
    }

    ko.applyBindings(new ExamplesViewModel({examples: examples, load: load}, function () { el.modal('hide'); }), el.find('.modal-content')[0]);

    el.modal('show').on('hidden.bs.modal', tearDown);
}

exports.ModalExamples = ModalExamples;
