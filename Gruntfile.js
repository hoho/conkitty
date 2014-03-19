module.exports = function(grunt) {
    'use strict';

    var fs = require('fs');

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
            tmp: ['tmp'],
            'browser.js': ['browser.js']
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
                ret = [fs.readFileSync('./_common.js', {encoding: 'utf8'}), '\n'],
                name;

            for (name in compiled) {
                ret.push('$C.tpl[\'' + name + '\'] = ' + compiled[name] + '\n');
            }

            grunt.file.write(f.dest, ret.join('\n'));
            grunt.log.writeln('File "' + f.dest + '" created.');
        });
    });

    grunt.registerTask('browser.js', function() {
        var browser = fs.readFileSync('./_browser.js', {encoding: 'utf8'}),
            common = fs.readFileSync('./_common.js', {encoding: 'utf8'});

        common = common.split('\n').join('\n    ');
        browser = browser.replace('/*** common.js inserted here ***/', common);

        fs.writeFileSync('./browser.js', browser);
        grunt.log.writeln('File "browser.js" created.');
    });

    grunt.registerTask('default', ['jshint', 'clean', 'browser.js', 'conkitty', 'uglify', 'qunit']);
};
