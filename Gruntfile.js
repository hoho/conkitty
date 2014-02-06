module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jshint: {
            all: {
                src: ['conkitty.js', 'browser.js', 'bin/conkitty', 'Gruntfile.js'],
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
                    'tmp/test.ctpl.js': ['test/test.ctpl']
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
        var conkittyCompile = require('./conkitty.js');

        this.files.forEach(function(f) {
            var compiled = conkittyCompile(grunt.file.read(f.src[0])),
                ret = ['if (!$C.tpl) { $C.tpl = {}; }\n'],
                name;

            for (name in compiled) {
                ret.push('$C.tpl[\'' + name + '\'] = ' + compiled[name] + '\n');
            }

            grunt.file.write(f.dest, ret.join('\n'));
            grunt.log.writeln('File "' + f.dest + '" created.');
        });
    });

    grunt.registerTask('default', ['jshint', 'clean', 'conkitty', 'uglify', 'qunit']);
};
