module.exports = function(grunt) {
    'use strict';

    var path = require('path'),
        assert = require('assert');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        eslint: {
            options: {
                configFile: 'eslint.json'
            },
            src: [
                'conkitty.js',
                'parser.js',
                'generator.js',
                'types.js',
                'errors.js',
                'utils.js',
                'bin/conkitty',
                'Gruntfile.js'
            ]
        },

/*        eslint: {

            all: {
                src: [
                    'conkitty.js',
                    'parser.js',
                    'generator.js',
                    'types.js',
                    'errors.js',
                    'utils.js',
                    'bin/conkitty',
                    'Gruntfile.js'
                ],
                options: {
                    jshintrc: '.jshintrc'
                }
            }
        },*/

        clean: {
            tmp: ['tmp']
        },

        conkitty: {
            test: {
                files: {
                    'tmp/test.ctpl.js': [
                        'test/basic.ctpl',
                        'test/selectors.ctpl',
                        'test/nodes.ctpl',
                        'test/ret.ctpl',
                        'test/namespaces.ctpl',
                        'test/classes.ctpl',
                        'test/precompileexpr.ctpl'
                    ]
                }
            }
        },

        uglify: {
            options: {
                preserveComments: 'some'
            },
            build: {
                files: {
                    'tmp/test.ctpl.min.js': 'tmp/test.ctpl.js',
                    'tmp/test.common.min.js': 'tmp/test.common.js'
                }
            }
        },

        qunit: {
            all: ['test/**/*.html']
        }
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerMultiTask('conkitty', function() {
        var Conkitty = require(__dirname + '/conkitty.js');

        this.files.forEach(function(f) {
            var conkitty = new Conkitty({prop1: 100500, prop2: 'yo', prop3: 4});

            f.src.map(function(filename) {
                conkitty.push(path.resolve(filename));
            });

            conkitty.generate('test.ctpl.map');

            assert.deepEqual(
                conkitty.getIncludes(),
                [
                    'test/includes/ns1_file1.css',
                    'test/includes/ns1_file1.js',
                    'test/includes/logo-img.png',
                    'test/includes/logo.png',
                    'test/includes/logo.css',
                    'test/includes/ns2_file1.css',
                    'test/includes/ns2_file1.js',
                    'test/includes/button.css',
                    'test/includes/textarea.css',
                    'test/includes/c.css',
                    'test/includes/file1.css',
                    'test/includes/file5yo.css'
                ].map(function(filename) { return path.normalize(path.join(__dirname, filename)); }),
                'Incorrect test includes'
            );

            var common = f.dest.replace(/ctpl\.js$/, 'common.js'),
                sourceMap = 'tmp/test.ctpl.map';

            grunt.file.write(common, conkitty.getCommonCode());
            grunt.log.writeln('File "' + common + '" created.');

            grunt.file.write(f.dest, conkitty.getTemplatesCode());
            grunt.log.writeln('File "' + f.dest + '" created.');

            grunt.file.write(sourceMap, conkitty.getSourceMap());
            grunt.log.writeln('File "' + sourceMap + '" created.');
        });
    });

    grunt.registerTask('assert-version', function() {
        var assertVersion = require('assert-version'),
            error;

        error = assertVersion({
            'conkitty.js': ''
        });

        if (error) {
            grunt.log.error(error);
            return false;
        }
    });

    grunt.registerTask('default', ['eslint', 'clean', 'assert-version', 'conkitty', 'uglify', 'qunit']);
};
