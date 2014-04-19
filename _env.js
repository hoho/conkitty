function envClass(parent, payload) {
    this.parent = parent;
    this.payload = payload;
}

function getEnv(obj) {
    return obj instanceof envClass ? obj : {};
}

function joinClasses() {
    var i, ret = [], arg;
    for (i = 0; i < arguments.length; i++) {
        if ((arg = arguments[i])) { ret.push(arg); }
    }
    return ret.length ? ret.join(' ') : undefined;
}

function getModClass(name, val) {
    if (val) { return val === true ? name : name + '_' + val; }
}
