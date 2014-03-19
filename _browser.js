function conkittyCompileScriptTags() {
    'use strict';

    var i,
        tpls = document.getElementsByTagName('script'),
        tpl,
        compiled,
        name;

    /* global $C */
    /* global conkittyCompile */

    /*** common.js inserted here ***/

    for (i = 0; i < tpls.length; i++) {
        tpl = tpls[i];
        if (tpl.getAttribute('type') === 'concat.js/template') {
            compiled = conkittyCompile(tpl.innerHTML);

            for (name in compiled) {
                eval('$C.tpl[name] = ' + compiled[name]);
            }
        }
    }
}

conkittyCompileScriptTags();
