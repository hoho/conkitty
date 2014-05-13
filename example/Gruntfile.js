module.exports = function(grunt) {
    'use strict';

    grunt.initConfig({
        // Task to compile templates from `src` folder.
        conkitty: {
            compile: {
                src: ['src/*.ctpl'],
                dest: {
                    common: 'dst/common.js',
                    templates: 'dst/templates.js',
                    sourcemap: 'dst/templates.map'
                }
            }
        },

        // Copy index.html
        copy: {
            'index.html': {
                src: 'src/index.html',
                dest: 'dst/index.html'
            }
        },

        clean: {
            dst: ['dst']
        },

        // Recompile templates in case something's changed.
        watch: {
            scripts: {
                files: ['src/*.*'],
                tasks: ['default'],
                options: {spawn: false}
            }
        }
    });


    grunt.loadNpmTasks('grunt-conkitty');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['clean', 'conkitty', 'copy']);
};
