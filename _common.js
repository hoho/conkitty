$C.tpl = {};

$C._p = function getPayload(env, payload, parent) {
    /* This function is for internal use from compiled templates.

    `env` is a `$C_` argument of a current template call.
    `payload` is a function to get payload.
    `parent` is a parent node for payload.

    There are two modes to call this function: expression mode and append mode.

    TEST PAYLOAD // In this case we use expression mode, we need just to
                 // examine the result.

    div#some-id   // In this case we use append mode (when `parent` is passed).
        PAYLOAD

    To get rid of duplicate calls:
        In both modes we call payload function only in case `env._p` is empty
        and remember the result in `env._p`.

        In append mode we append `env._p` to `parent` and reset `env._p`.
    */
    if (payload) {
        var ret = env._p;

        if (!ret) {
            ret = env._p = payload();
        }

        if (!parent) {
            return ret.firstChild ? ret : undefined;
        }

        ret && parent.appendChild(ret);
        delete env._p;
    }
};
