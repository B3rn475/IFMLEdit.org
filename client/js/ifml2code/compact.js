// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    createZip = require('jszip');

function compactFolder(folder, id, transformed) {
    _.each(transformed[id].children || [], function (cid) {
        var child = transformed[cid];
        if (child.isFolder) {
            compactFolder(folder.folder(child.name), cid, transformed);
        } else {
            folder.file(child.name, child.content);
        }
    });
}

function compact(transformed) {
    var zip = createZip();
    compactFolder(zip, '', transformed);
    return zip;
}

exports.compact = compact;
