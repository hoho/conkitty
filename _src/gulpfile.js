'use strict';

var gulp = require('gulp');

var eslint = require('gulp-eslint');
var uglify = require('gulp-uglify');

var conkitty = require('node-conkitty');


gulp.task('eslint', function() {
    return gulp.src(['gulpfile.js', 'pages/**/*.js', 'blocks/**/*.js'])
        .pipe(eslint({
            rules: {
                'quotes': [2, 'single'],
                'no-shadow-restricted-names': 0,
                'no-underscore-dangle': 0
            },
            env: {
                'node': true,
                'browser': true
            }
        }))
        .pipe(eslint.format());
});


gulp.task('conkitty', function() {
    var deps = conkitty.compile('pages/index.ctpl');
    console.log(deps, conkitty.applyTemplate('Conkitty'));
});


gulp.task('default', ['eslint', 'conkitty']);
