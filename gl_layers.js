var gl = null;
var layers = [];
var uniforms = {};

let screen_mesh = [

[
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
],

[
    [0, 1, 2],
    [0, 2, 3]
]

];


function hex2rgba(x){
    x = Number('0x' + x.slice(1));
    return [((x >> 16) & 0xff) / 255.0, ((x >> 8) & 0xff) / 255.0, (x & 0xff) / 255.0, 1.0];
}

function rgba2hex(vals){
    return '#' + vals.slice(0, -1).map(function(x){return Math.round(x * 255).toString(16).padStart(2, '0')}).join('');
}

function setup_gl(canvas, cull=null, depth_test=true){
    let rect = canvas.getBoundingClientRect();
    canvas.oncontextmenu = function(e) { e.preventDefault(); e.stopPropagation(); }
    gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true});
    // gl.getExtension("OES_texture_float");
    gl.getExtension("OES_texture_float_linear");
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("EXT_float_blend");
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.disable(gl.DITHER);
    if (depth_test) gl.enable(gl.DEPTH_TEST);
    if (cull != null){
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CW);
        if (cull == 'front'){
            gl.cullFace(gl.FRONT);
        } else {
            gl.cullFace(gl.BACK);
        }
    }
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function load_file(path){
    return new Promise((resolve, reject) => {
        let r = new XMLHttpRequest();
        r.open('GET', path, true);
        r.onload = function(){
            if (r.status == 200){
                resolve(r.responseText);
            } else {
                reject(new Error('failed. status: ' + r.status));
            }
        };
        r.onerror = function(){
            reject(new Error('failed. onerror'));
        };
        r.send();
    });
}

function compile_program(vs_src_path, fs_src_path, global_src_path = 'glsl/global.glsl'){
    return new Promise((resolve, reject) =>{
        Promise.all([
            load_file(global_src_path),
            load_file(vs_src_path),
            load_file(fs_src_path)
        ]).then((args) => {
            try {
                [global_src, vs_src, fs_src] = args;
                let vs = compile_shader('#version 300 es\n' + global_src + vs_src, gl.VERTEX_SHADER);
                let fs = compile_shader('#version 300 es\n' + global_src + fs_src, gl.FRAGMENT_SHADER);
                let p = link_program(vs, fs);
                resolve(p);    
            } catch(err) {
                reject(err);
            }
        });
    });
}

function compile_shader(source, type){
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        throw new Error(print_error(source, gl.getShaderInfoLog(shader)));
    }
    return shader;
}

function link_program(vertex_shader, fragment_shader){
    let program = gl.createProgram();
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
        console.error('Failed to link program:', gl.getProgramInfoLog(program));
        return;
    }
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)){
        console.error('Failed to validate program:', gl.getProgramInfoLog(program));
        return;
    }
    return program;
}

function print_error(source, err){
    let errs = err.slice(0, -2).split('\n');
    let lines = source.split('\n');
    let out = '\n\n';
    for (let i_err = 0; i_err < errs.length; i_err++){
        let [_, char_start, line_num, glsl_err] = errs[i_err].match(/ERROR: ([0-9]+):([0-9]+): (.+)/);
        [char_start, line_num] = [parseInt(char_start), parseInt(line_num)];
        out += `GLSL Error ${i_err}: ${glsl_err}\n${line_num - 1}: ${lines[line_num - 2].trimEnd()}\n${line_num}:*${lines[line_num - 1].trimEnd()}\n${line_num + 1}: ${lines[line_num].trimEnd()}\n`
    }
    return out;
}

function create_buffer(data, type, draw_type){
    buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, draw_type);
    return buffer;
}

function create_texture(width, height, color=[0, 0, 0, 1.0], offset=0, edge='clamp'){
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + offset);  // use texture 0 temporarily
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    if (edge == 'repeat'){
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } else if (edge == 'clamp'){
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    if (color != null && Array.isArray(color)){
        color = new Float32Array(Array(width * height).fill(color).flat());
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, color);
    texture.width = width;
    texture.height = height;
    return texture;
}

function create_fbo(width, height){
    let fbo = gl.createFramebuffer();
    let depthbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthbuffer);
    fbo.width = width;
    fbo.height = height;
    return fbo;
}

function download_texture(width, height){
    let buffer = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    return buffer;
}
