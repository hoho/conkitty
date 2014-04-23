module.exports = function(grunt) {
    'use strict';

    var path = require('path');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jshint: {
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
        },

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
                        'test/ret.ctpl'
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
                    'tmp/test.ctpl.min.js': 'tmp/test.ctpl.js'
                }
            }
        },

        qunit: {
            all: ['test/**/*.html']
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerMultiTask('conkitty', function() {
        var Conkitty = require(__dirname + '/conkitty.js'),
            conkitty;

        this.files.forEach(function(f) {
            conkitty = new Conkitty();

            f.src.map(function(filename) {
                conkitty.push(grunt.file.read(filename), path.resolve(path.dirname(filename)));
            });

            conkitty.generate();

            grunt.file.write(f.dest, conkitty.getTemplatesCode());
            grunt.log.writeln('File "' + f.dest + '" created.');
        });
    });

    grunt.registerTask('default', ['jshint', 'clean', 'conkitty', 'uglify', 'qunit']);
};
