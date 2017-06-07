/*jslint node: true */
"use strict";

var gulp = require('gulp'),
    rimraf = require('gulp-rimraf'),
    rename = require('gulp-rename'),
    minifyCss = require('gulp-cssnano'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    minifyjs = require('gulp-uglify'),
    merge = require('merge-stream');

gulp.task('clean', function () {
    return gulp.src('./www/*', {read: false}).pipe(rimraf({ force: true}));
});

gulp.task('html', function () {
    return gulp.src('./src/index.html').pipe(gulp.dest('./www'));
});

gulp.task('vendor', function () {
    return merge(
        gulp.src([
            './node_modules/materialize-css/dist/js/materialize.min.js',
            './node_modules/jquery/dist/jquery.min.js',
            './node_modules/nedb/browser-version/out/nedb.min.js',
            './node_modules/bluebird/js/browser/bluebird.min.js'
        ]).pipe(gulp.dest('./www/js')),
        gulp.src('./node_modules/knockout/build/output/knockout-latest.js')
            .pipe(rename('knockout.min.js'))
            .pipe(gulp.dest('./www/js'))
    );
});

gulp.task('js', function () {
    return browserify({
        entries: './src/js/index.js',
        debug: true
    })
        .transform('exposify', {
            expose: {
                'jquery': '$',
                'knockout': 'ko',
                'nedb': 'Nedb',
                'bluebird': 'Promise'
            }
        })
        .transform('stringify', {
            extensions: ['.html'],
            minify: true,
            minifyOptions: {
                removeComments: false
            }
        })
        .bundle()
        .pipe(source('index.js'))
        .pipe(buffer())
        .pipe(minifyjs())
        .pipe(gulp.dest('./www/js'));
});

gulp.task('css', function () {
    return merge(
        gulp.src('./node_modules/materialize-css/dist/css/materialize.min.css').pipe(gulp.dest('./www/css')),
        gulp.src('./node_modules/material-design-icons-iconfont/dist/material-design-icons.css')
                .pipe(minifyCss({compatibility: 'ie8'}))
                .pipe(rename({suffix: '.min'}))
                .pipe(gulp.dest('./www/css')),
        gulp.src('./node_modules/materialize-css/dist/fonts/roboto/*').pipe(gulp.dest('./www/fonts/roboto')),
        gulp.src('./node_modules/material-design-icons-iconfont/dist/fonts/MaterialIcons-Regular.*').pipe(gulp.dest('./www/css/fonts'))
    );
});

gulp.task('build', ['html', 'css', 'js', 'vendor']);

gulp.task('default', ['clean'], function () {
    return gulp.start('build');
});
