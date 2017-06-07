// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true */
"use strict";

var express = require('express');

function createRouter() {
    var router = express.Router();

    return router;
}

exports.createRouter = createRouter;
