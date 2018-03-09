/*jslint node: true, nomen: true */
"use strict";

var gulp = require('gulp'),
    path = require('path'),
    gulpif = require('gulp-if'),
    rimraf = require('gulp-rimraf'),
    rename = require('gulp-rename'),
    sass = require('gulp-sass'),
    minifyCss = require('gulp-cssnano'),
    sourcemaps = require('gulp-sourcemaps'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    extractor = require('gulp-extract-sourcemap'),
    minifyjs = require('gulp-uglify'),
    minifyjson = require('gulp-json-minify'),
    merge = require('merge-stream'),
    pug = require('gulp-pug'),
    icongen = require('icon-gen');

var production = process.env.NODE_ENV === 'production',
    base_path = process.env.BASE_PATH || '/';

if (production) {
    console.log('PRODUCTION BUILD');
} else {
    console.log('DEVELOPMENT BUILD');
}

gulp.task('clean', function () {
    return gulp.src('./public/*', {read: false, dot: true}).pipe(rimraf({ force: true }));
});

gulp.task('html', function () {
    return gulp.src('./client/index.pug')
        .pipe(pug({
            locals: {base_path: base_path},
            pretty: !production
        }))
        .pipe(gulp.dest('./public'));
});

gulp.task('images', function () {
    return gulp.src('./client/img/*').pipe(gulp.dest('./public/img'));
});

gulp.task('examples', function () {
    return merge(
        gulp.src('./client/examples/*.png').pipe(gulp.dest('./public/examples')),
        gulp.src('./client/examples/*.json').pipe(minifyjson()).pipe(gulp.dest('./public/examples'))
    );
});

gulp.task('favicon', function () {
    return icongen('./client/favicon.svg', './public');
});

gulp.task('vendor', function () {
    return merge(
        gulp.src(['./node_modules/jquery/dist/jquery.js',
                './node_modules/backbone/backbone.js',
                './node_modules/jointjs/dist/joint.js',
                './node_modules/bootstrap/dist/js/bootstrap.js',
                './node_modules/bootstrap-notify/bootstrap-notify.js',
                './node_modules/filesaver.js/FileSaver.js',
                './node_modules/almost/dist/almost.js',
                './node_modules/almost-joint/dist/almost-joint.js'])
                .pipe(gulpif(!production, sourcemaps.init()))
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(gulpif(!production, sourcemaps.write('./')))
                .pipe(gulp.dest('./public/js')),
        gulp.src('./node_modules/lodash/index.js')
                .pipe(rename('lodash.js'))
                .pipe(gulpif(!production, sourcemaps.init()))
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(gulpif(!production, sourcemaps.write('./')))
                .pipe(gulp.dest('./public/js')),
        gulp.src('./node_modules/knockout/build/output/knockout-latest.debug.js')
                .pipe(rename('knockout.js'))
                .pipe(gulpif(!production, sourcemaps.init()))
                .pipe(minifyjs())
                .pipe(rename({suffix: '.min'}))
                .pipe(gulpif(!production, sourcemaps.write('./')))
                .pipe(gulp.dest('./public/js')),
        gulp.src(['./node_modules/jointjs/dist/joint.css',
                './node_modules/bootstrap/dist/css/bootstrap.css',
                './node_modules/almost-joint/dist/almost-joint.css'])
                .pipe(gulpif(!production, sourcemaps.init()))
                .pipe(minifyCss({compatibility: 'ie8'}))
                .pipe(rename({suffix: '.min'}))
                .pipe(gulpif(!production, sourcemaps.write('./')))
                .pipe(gulp.dest('./public/css')),
        gulp.src('./node_modules/bootstrap/dist/fonts/**').pipe(gulp.dest('./public/fonts'))
    );
});

gulp.task('index', function () {
    return browserify({
        entries: './client/js/index.js',
        debug: !production,
    })
        .transform('exposify', {
            expose: {
                'jquery': '$',
                'lodash': '_',
                'backbone': 'Backbone',
                'knockout': 'ko',
                'joint': 'joint',
                'window': 'window',
                'navigator': 'navigator',
                'document': 'document',
                'atob': 'atob',
                'Uint8Array': 'Uint8Array',
                'Blob': 'Blob',
                'FileSaver': 'saveAs',
                'FileReader': 'FileReader',
                'URL': 'URL',
                'Worker': 'Worker',
                'almost': 'almost',
                'almost-joint': 'almost.plugins.joint'
            }
        })
        .transform('stringify', {
            extensions: ['.svg', '.html'],
            minify: production,
            minifyOptions: {
                removeComments: false
            }
        })
        .transform('ejsify')
        .bundle()
        .pipe(source('index.js'))
        .pipe(buffer())
        .pipe(gulpif(!production, extractor({
            basedir: path.join(__dirname, './client/js/'),
            fakeFix: true
        })))
        .pipe(gulpif(production, minifyjs()))
        .pipe(gulp.dest('./public/js'));
});

gulp.task('sass', function () {
    return gulp.src('./client/index.scss')
        .pipe(gulpif(!production, sourcemaps.init()))
        .pipe(sass().on('error', sass.logError))
        .pipe(minifyCss({compatibility: 'ie8'}))
        .pipe(rename('editor.min.css'))
        .pipe(gulpif(!production, sourcemaps.write('./')))
        .pipe(gulp.dest('./public/css'));
});

gulp.task('demo-web-server-index', function () {
    return browserify({
        entries: './client/demo-web-server/index.js',
        debug: !production,
        insertGlobalVars: {
            setImmediate: function () { return function (cb) { setTimeout(cb, 0); }; }
        }
    })
        .transform('aliasify', {
            aliases: {
                'fs': './client/demo-web-server/shims/fs.js',
                'http': './client/demo-web-server/shims/http.js'
            },
            global: true
        })
        .bundle()
        .pipe(source('demo-web-server.js'))
        .pipe(buffer())
        .pipe(gulpif(!production, extractor({
            basedir: path.join(__dirname, './client/demo-web-server/'),
            fakeFix: true
        })))
        .pipe(gulpif(production, minifyjs()))
        .pipe(gulp.dest('./public/js'));
});

gulp.task('demo-web-client-html', function () {
    return gulp.src('./client/demo-web-client/index.pug')
        .pipe(pug({
            locals: {base_path: base_path},
            pretty: !production
        }))
        .pipe(gulp.dest('./public/web-client'));
});

gulp.task('demo-mobile-html', function () {
    return gulp.src('./client/demo-mobile/index.pug')
        .pipe(pug({
            locals: {base_path: base_path},
            pretty: !production
        }))
        .pipe(gulp.dest('./public/mobile'));
});

gulp.task('demo-web-server-css', function () {
    return gulp.src('./node_modules/bootstrap/dist/css/bootstrap.min.css').pipe(gulp.dest('./public/web-server/css'));
});

gulp.task('demo-web-client-css', function () {
    return gulp.src('./node_modules/bootstrap/dist/css/bootstrap.min.css').pipe(gulp.dest('./public/web-client/css'));
});

gulp.task('demo-mobile-css', function () {
    return merge(
        gulp.src('./node_modules/materialize-css/dist/css/materialize.min.css').pipe(gulp.dest('./public/mobile/css')),
        gulp.src('./node_modules/material-design-icons-iconfont/dist/material-design-icons.css')
                .pipe(minifyCss({compatibility: 'ie8'}))
                .pipe(rename({suffix: '.min'}))
                .pipe(gulp.dest('./public/mobile/css')),
        gulp.src('./node_modules/materialize-css/dist/fonts/roboto/*').pipe(gulp.dest('./public/mobile/fonts/roboto')),
        gulp.src('./node_modules/material-design-icons-iconfont/dist/fonts/MaterialIcons-Regular.*').pipe(gulp.dest('./public/mobile/css/fonts'))
    );
});

gulp.task('demo-mobile-images', function () {
    return gulp.src('./client/demo-mobile/img/*').pipe(gulp.dest('./public/mobile/img'));
});

gulp.task('demo-web-server-js', function () {
    return gulp.src([
        './node_modules/bootstrap/dist/js/bootstrap.min.js',
        './node_modules/jquery/dist/jquery.min.js',
    ]).pipe(gulp.dest('./public/web-server/js'));
});

gulp.task('demo-web-client-js', function () {
    return merge(
        gulp.src([
            './node_modules/bootstrap/dist/js/bootstrap.min.js',
            './node_modules/bootstrap-notify/bootstrap-notify.min.js',
            './node_modules/jquery/dist/jquery.min.js',
            './node_modules/nedb/browser-version/out/nedb.min.js',
            './node_modules/bluebird/js/browser/bluebird.min.js'
        ]).pipe(gulp.dest('./public/web-client/js')),
        gulp.src('./node_modules/knockout/build/output/knockout-latest.js')
            .pipe(rename('knockout.min.js'))
            .pipe(gulp.dest('./public/web-client/js'))
    );
});

gulp.task('demo-mobile-js', function () {
    return merge(
        gulp.src([
            './node_modules/materialize-css/dist/js/materialize.min.js',
            './node_modules/jquery/dist/jquery.min.js',
            './node_modules/nedb/browser-version/out/nedb.min.js',
            './node_modules/bluebird/js/browser/bluebird.min.js'
        ]).pipe(gulp.dest('./public/mobile/js')),
        gulp.src('./node_modules/knockout/build/output/knockout-latest.js')
            .pipe(rename('knockout.min.js'))
            .pipe(gulp.dest('./public/mobile/js'))
    );
});

gulp.task('demo-web-client-index', function () {
    return browserify({
        entries: './client/demo-web-client/index.js',
        debug: !production,
    })
        .transform('exposify', {
            expose: {
                'jquery': '$',
                'window': 'window',
                'document': 'document',
                'knockout': 'ko',
                'nedb': 'Nedb',
                'bluebird': 'Promise'
            }
        })
        .bundle()
        .pipe(source('index.js'))
        .pipe(buffer())
        .pipe(gulpif(!production, extractor({
            basedir: path.join(__dirname, './client/js/'),
            fakeFix: true
        })))
        .pipe(gulpif(production, minifyjs()))
        .pipe(gulp.dest('./public/web-client/js'));
});

gulp.task('demo-mobile-index', function () {
    return browserify({
        entries: './client/demo-mobile/index.js',
        debug: !production,
    })
        .transform('exposify', {
            expose: {
                'jquery': '$',
                'window': 'window',
                'document': 'document',
                'knockout': 'ko',
                'nedb': 'Nedb',
                'bluebird': 'Promise'
            }
        })
        .bundle()
        .pipe(source('index.js'))
        .pipe(buffer())
        .pipe(gulpif(!production, extractor({
            basedir: path.join(__dirname, './client/js/'),
            fakeFix: true
        })))
        .pipe(gulpif(production, minifyjs()))
        .pipe(gulp.dest('./public/mobile/js'));
});

gulp.task('demo-web-server', ['demo-web-server-index', 'demo-web-server-css', 'demo-web-server-js']);
gulp.task('demo-web-client', ['demo-web-client-index', 'demo-web-client-html', 'demo-web-client-css', 'demo-web-client-js']);
gulp.task('demo-mobile', ['demo-mobile-index', 'demo-mobile-html', 'demo-mobile-css', 'demo-mobile-images', 'demo-mobile-js']);

gulp.task('build', ['html', 'index', 'demo-web-server', 'demo-web-client', 'demo-mobile', 'vendor', 'sass', 'images', 'favicon', 'examples']);

gulp.task('default', ['clean'], function () {
    return gulp.start('build');
});
